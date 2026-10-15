from aiogram.fsm.state import State, StatesGroup


class AddGarage(StatesGroup):
    type = State()
    name = State()
    district = State()
    address = State()
    photos = State()
    price = State()
    lift = State()
    pit = State()
    tools = State()
    size = State()
    hours = State()
    description = State()
    owner_name = State()
    owner_phone = State()
    owner_contact = State()
    preview = State()


class EditGarage(StatesGroup):
    value = State()
    photos = State()


class Booking(StatesGroup):
    date = State()
    slots = State()


class OwnerRequest(StatesGroup):
    name = State()
    phone = State()
    object_type = State()
    address = State()


class Reject(StatesGroup):
    reason = State()
