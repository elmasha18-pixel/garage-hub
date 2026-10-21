"""Заявка владельца на размещение: 4 шага, сохраняется в базу и приходит админу."""
import logging

from aiogram import F, Router
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, Message

from tgbot import keyboards as kb
from core import service
from tgbot import texts as t
from tgbot.callbacks import OwnerCb
from tgbot.states import OwnerRequest
from core.utils import answer_quietly, reset

log = logging.getLogger(__name__)
router = Router(name="owners")


async def start(message: Message, state: FSMContext) -> None:
    await message.answer(t.OWNER_INTRO)
    await state.set_state(OwnerRequest.name)
    await message.answer(t.owner_step(1, t.OWNER_NAME), reply_markup=kb.cancel_menu())


@router.message(OwnerRequest.name, F.text)
async def owner_name(message: Message, state: FSMContext):
    await state.update_data(owner={"name": message.text.strip()})
    await state.set_state(OwnerRequest.phone)
    await message.answer(t.owner_step(2, t.OWNER_PHONE), reply_markup=kb.phone_menu())


@router.message(OwnerRequest.phone, F.contact | F.text)
async def owner_phone(message: Message, state: FSMContext):
    phone = message.contact.phone_number if message.contact else message.text.strip()
    if sum(ch.isdigit() for ch in phone) < 10:
        await message.answer("Похоже, в номере не хватает цифр. Пример: +7 999 123-45-67")
        return
    data = (await state.get_data()).get("owner", {})
    data["phone"] = phone
    await state.update_data(owner=data)
    await state.set_state(OwnerRequest.object_type)
    await message.answer("Номер записан.", reply_markup=kb.cancel_menu())
    await message.answer(t.owner_step(3, t.OWNER_TYPE), reply_markup=kb.owner_type())


@router.callback_query(OwnerCb.filter(), OwnerRequest.object_type)
async def owner_type(callback: CallbackQuery, callback_data: OwnerCb, state: FSMContext):
    await answer_quietly(callback)
    data = (await state.get_data()).get("owner", {})
    data["object_type"] = t.object_type(callback_data.value)
    await state.update_data(owner=data)
    await state.set_state(OwnerRequest.address)
    await callback.message.edit_text(f"{t.OWNER_TYPE} <b>{data['object_type']}</b>")
    await callback.message.answer(t.owner_step(4, t.OWNER_ADDRESS))


@router.message(OwnerRequest.address, F.text)
async def owner_address(message: Message, state: FSMContext):
    data = (await state.get_data()).get("owner", {})
    await reset(state)
    user = message.from_user
    await message.answer(t.OWNER_DONE, reply_markup=kb.home_markup(user.id))
    await service.create_owner_request(
        message.bot, user.id, user.username, data.get("name") or "", data.get("phone") or "",
        "garage" if data.get("object_type") == t.object_type("garage") else "detailing",
        message.text.strip(),
    )
