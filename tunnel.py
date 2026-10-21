"""Временный публичный HTTPS-адрес для Mini App через localhost.run (без регистрации, через SSH).

Держит туннель к локальному веб-серверу бота, при обрыве переподключается.
Текущий адрес пишет в cache/webapp_url.txt — бот сам подхватывает его и обновляет кнопку «Открыть».
Адрес у бесплатного туннеля меняется при переподключении — это нормально.

Это временное решение, пока бот живёт на маке. На сервере будет постоянный домен с HTTPS.
"""
import re
import signal
import subprocess
import sys
import time

from config import CACHE_DIR, WEB_PORT, WEBAPP_URL_FILE

URL_RE = re.compile(r"https://[a-z0-9-]+\.lhr\.life")
SSH = [
    "ssh", "-T",
    "-o", "StrictHostKeyChecking=accept-new",
    "-o", "ServerAliveInterval=20",
    "-o", "ServerAliveCountMax=3",
    "-o", "ExitOnForwardFailure=yes",
    "-R", f"80:localhost:{WEB_PORT}",
    "nokey@localhost.run",
]

proc = None


def log(message: str) -> None:
    print(time.strftime("%Y-%m-%d %H:%M:%S"), "tunnel:", message, flush=True)


def write_url(url: str) -> None:
    CACHE_DIR.mkdir(exist_ok=True)
    WEBAPP_URL_FILE.write_text(url, encoding="utf-8")


def stop(*_):
    write_url("")
    if proc and proc.poll() is None:
        proc.terminate()
    log("остановлен")
    sys.exit(0)


def main():
    global proc
    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    pause = 3
    while True:
        log("подключаюсь к localhost.run…")
        started = time.monotonic()
        proc = subprocess.Popen(SSH, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)
        url = ""
        for line in proc.stdout:
            found = URL_RE.search(line)
            if found and found.group(0) != url:
                url = found.group(0)
                write_url(url)
                log(f"адрес приложения: {url}")
                pause = 3
        proc.wait()
        write_url("")
        if time.monotonic() - started > 60:
            pause = 3
        log(f"туннель оборвался, переподключение через {pause} с")
        time.sleep(pause)
        pause = min(pause * 2, 60)


if __name__ == "__main__":
    main()
