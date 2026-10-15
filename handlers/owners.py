"""Заявка владельца на размещение: 4 шага, сохраняется в базу и приходит админу."""
import logging

from aiogram import F, Router
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, Message

import db
import keyboards as kb
import texts as t
from callbacks import OwnerCb
from config import ADMIN_ID
from states import OwnerRequest
from utils import answer_quietly, reset

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
    lead = {
        "name": data.get("name"),
        "phone": data.get("phone"),
        "object_type": data.get("object_type"),
        "address": message.text.strip(),
        "telegram_id": user.id,
        "telegram_username": t.username_label(user.username, user.id),
    }
    saved = None
    try:
        saved = await db.create_owner_request(lead)
    except Exception:
        log.exception("Не удалось сохранить заявку владельца")
    await message.answer(t.OWNER_DONE, reply_markup=kb.home_markup(user.id))
    await message.bot.send_message(
        ADMIN_ID,
        t.owner_lead(saved or {**lead, "id": "—"}),
        reply_markup=kb.lead_actions(saved["id"]) if saved else None,
    )
