"""Тестовый стенд: прогоняет обработчики бота без Telegram (фейковая сессия), но с настоящей базой."""
import itertools
import sys
import time
from datetime import datetime

sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent.parent))

from aiogram import Bot
from aiogram.client.default import DefaultBotProperties
from aiogram.client.session.base import BaseSession
from aiogram.enums import ParseMode
from aiogram.types import Chat, InlineKeyboardMarkup, Message, PhotoSize, User

from tgbot import app

_ids = itertools.count(5000)
_upd = itertools.count(1)
VERBOSE = True


def fmt_markup(markup):
    if not isinstance(markup, InlineKeyboardMarkup):
        if markup is not None and hasattr(markup, "keyboard"):
            return "  [reply] " + " | ".join(b.text for row in markup.keyboard for b in row)
        return ""
    return "\n".join("  " + " | ".join(f"[{b.text}]" for b in row) for row in markup.inline_keyboard)


class FakeSession(BaseSession):
    def __init__(self):
        super().__init__()
        self.messages = {}   # message_id -> dict
        self.log = []
        self.alerts = []

    async def close(self):
        pass

    async def stream_content(self, *a, **k):
        yield b""

    def _store(self, chat_id, text, markup, photo=False, mid=None):
        mid = mid or next(_ids)
        prev = self.messages.get(mid, {})
        self.messages[mid] = {"message_id": mid, "chat_id": chat_id, "text": text if text is not None else prev.get("text"),
                              "markup": markup, "photo": photo or prev.get("photo", False), "t": time.monotonic()}
        return mid

    def _msg(self, bot, mid, chat_id, text, photo):
        kw = dict(message_id=mid, date=datetime.now(), chat=Chat(id=chat_id, type="private"),
                  from_user=User(id=1, is_bot=True, first_name="bot"))
        if photo:
            kw["photo"] = [PhotoSize(file_id=f"FILEID{mid}", file_unique_id=f"u{mid}", width=1, height=1)]
            kw["caption"] = text
        else:
            kw["text"] = text
        return Message(**kw).as_(bot)

    def out(self, kind, chat_id, text, markup):
        self.log.append((kind, chat_id, text, markup))
        if VERBOSE:
            who = "ADMIN" if chat_id == app.ADMIN_ID else f"user{chat_id}"
            print(f"\n→ {who} {kind}\n{text or ''}\n{fmt_markup(markup)}".rstrip())

    async def make_request(self, bot, method, timeout=None):
        name = type(method).__name__
        if name == "GetMe":
            return User(id=1, is_bot=True, first_name="bot", username="testbot")
        if name in ("SendMessage", "SendPhoto"):
            text = getattr(method, "text", None) or getattr(method, "caption", None)
            mid = self._store(method.chat_id, text, method.reply_markup, photo=name == "SendPhoto")
            self.out(name, method.chat_id, text, method.reply_markup)
            return self._msg(bot, mid, method.chat_id, text, name == "SendPhoto")
        if name == "SendMediaGroup":
            self.out(name, method.chat_id, f"<album {len(method.media)} фото>", None)
            return [self._msg(bot, next(_ids), method.chat_id, None, True) for _ in method.media]
        if name in ("EditMessageText", "EditMessageMedia", "EditMessageReplyMarkup", "EditMessageCaption"):
            mid = method.message_id
            old = self.messages.get(mid, {})
            text = getattr(method, "text", None)
            if name == "EditMessageMedia":
                text = method.media.caption
            if name == "EditMessageReplyMarkup":
                text = old.get("text")
            self._store(method.chat_id or old.get("chat_id"), text, method.reply_markup, mid=mid,
                        photo=name == "EditMessageMedia" or old.get("photo", False))
            self.out(name, method.chat_id or old.get("chat_id"), text, method.reply_markup)
            return self._msg(bot, mid, method.chat_id or old.get("chat_id"), text, self.messages[mid]["photo"])
        if name == "AnswerCallbackQuery":
            if method.text:
                self.alerts.append(method.text)
                if VERBOSE:
                    print(f"  (всплывашка{'!' if method.show_alert else ''}: {method.text})")
            return True
        return True


class Harness:
    def __init__(self):
        self.session = FakeSession()
        self.bot = Bot("123456:TESTTOKENTESTTOKENTESTTOKENTESTTOKEN", session=self.session,
                       default=DefaultBotProperties(parse_mode=ParseMode.HTML))
        self.dp = app.build_dispatcher()

    def user(self, uid, username="tester"):
        return Client(self, uid, username)


class Client:
    def __init__(self, h, uid, username):
        self.h, self.uid, self.username = h, uid, username

    def _from(self):
        return {"id": self.uid, "is_bot": False, "first_name": "Test", "username": self.username}

    async def _feed(self, upd):
        upd["update_id"] = next(_upd)
        await self.h.dp.feed_raw_update(self.h.bot, upd)

    async def send(self, text=None, photo=None, contact=None):
        if VERBOSE:
            print(f"\n══ user{self.uid} пишет: {text or ('<фото>' if photo else '<контакт>')}")
        msg = {"message_id": next(_ids), "date": int(time.time()),
               "chat": {"id": self.uid, "type": "private"}, "from": self._from()}
        if text is not None:
            msg["text"] = text
            if text.startswith("/"):
                msg["entities"] = [{"type": "bot_command", "offset": 0, "length": len(text.split()[0])}]
        if photo:
            msg["photo"] = [{"file_id": photo, "file_unique_id": photo + "u", "width": 10, "height": 10}]
        if contact:
            msg["contact"] = {"phone_number": contact, "first_name": "Test", "user_id": self.uid}
        await self._feed({"message": msg})

    def find(self, label, exact=False):
        mine = [m for m in self.h.session.messages.values() if m["chat_id"] == self.uid
                and isinstance(m["markup"], InlineKeyboardMarkup)]
        for m in sorted(mine, key=lambda m: m["t"], reverse=True):
            for row in m["markup"].inline_keyboard:
                for b in row:
                    if (b.text == label if exact else label in b.text) and b.callback_data:
                        return m, b
        raise AssertionError(f"Кнопка «{label}» не найдена у user{self.uid}")

    async def click(self, label, exact=False):
        m, b = self.find(label, exact)
        if VERBOSE:
            print(f"\n══ user{self.uid} жмёт [{b.text}]")
        message = {"message_id": m["message_id"], "date": int(time.time()),
                   "chat": {"id": self.uid, "type": "private"},
                   "from": {"id": 1, "is_bot": True, "first_name": "bot"}}
        if m["photo"]:
            message["photo"] = [{"file_id": "x", "file_unique_id": "x", "width": 1, "height": 1}]
            message["caption"] = m["text"] or ""
        else:
            message["text"] = m["text"] or ""
        await self._feed({"callback_query": {
            "id": str(next(_ids)), "from": self._from(), "chat_instance": "1",
            "data": b.callback_data, "message": message,
        }})

    def last_text(self):
        mine = [m for m in self.h.session.messages.values() if m["chat_id"] == self.uid]
        return max(mine, key=lambda m: m["t"])["text"] if mine else ""


async def click_data(client, data, text="старое сообщение"):
    """Нажатие кнопки по её данным — имитирует старую кнопку, которой уже нет на экране."""
    print(f"\n══ user{client.uid} жмёт старую кнопку {data}")
    await client._feed({"callback_query": {
        "id": str(next(_ids)), "from": client._from(), "chat_instance": "1", "data": data,
        "message": {"message_id": next(_ids), "date": int(time.time()),
                    "chat": {"id": client.uid, "type": "private"},
                    "from": {"id": 1, "is_bot": True, "first_name": "bot"}, "text": text},
    }})
