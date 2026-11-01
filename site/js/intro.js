/* Заставка «ворота поднимаются». Подключается обычным скриптом в <head>, до отрисовки страницы,
   чтобы сайт не мелькнул перед заставкой. Показывается один раз за визит; ?intro — показать снова,
   ?slow — втрое медленнее (посмотреть анимацию). Клик или клавиша — пропустить. */
(function () {
  var KEY = "gh-intro-seen";
  var root = document.documentElement;
  var query = location.search;
  var seen = false;
  try { seen = sessionStorage.getItem(KEY) === "1"; } catch (e) {}
  if (seen && !/[?&]intro\b/.test(query)) return;
  try { sessionStorage.setItem(KEY, "1"); } catch (e) {}

  var k = /[?&]slow\b/.test(query) ? 3 : 1;
  if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) k = 0.5;
  root.style.setProperty("--gh-k", String(k));
  root.classList.add("gh-intro");

  function finish() {
    root.classList.remove("gh-intro");
    root.style.removeProperty("--gh-k");
    document.removeEventListener("keydown", finish);
  }
  setTimeout(finish, 2100 * k);
  document.addEventListener("keydown", finish);
  document.addEventListener("click", function (e) {
    if (e.target.closest && e.target.closest(".gh-splash")) finish();
  });
})();
