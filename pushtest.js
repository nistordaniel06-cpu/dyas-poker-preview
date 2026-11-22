// Profil → „Trimite-mi o notificare de test”: reînnoiește abonamentul acestui telefon și spune clar dacă notificările ajung.
const DY = () => window.DY;
const b64 = (s) => { const p = "=".repeat((4 - (s.length % 4)) % 4); const r = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(r, (c) => c.charCodeAt(0)); };
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

/** Abonamentul acestui dispozitiv, trimis din nou serverului (dacă lipsea sau s-a schimbat). */
async function refreshSub() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    throw new Error(isIOS() && !standalone() ? "Pe iPhone, notificările merg doar din aplicația instalată: Safari → Partajează → Adaugă pe ecranul principal, apoi deschide DYAS Poker de pe ecran." : "Browserul acesta nu suportă notificări.");
  }
  if (Notification.permission === "denied") throw new Error(isIOS() ? "Notificările sunt blocate. Deschide Setări → Notificări → DYAS Poker și pornește „Permite notificările”." : "Notificările sunt blocate din setările browserului pentru acest site.");
  if (Notification.permission !== "granted" && (await Notification.requestPermission()) !== "granted") throw new Error("Nu ai permis notificările.");
  const cfg = await DY().api("GET", "/api/config");
  if (!cfg.vapidPublic) throw new Error("Notificările nu sunt configurate pe server.");
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(cfg.vapidPublic) });
  await DY().api("POST", "/api/push/subscribe", { subscription: sub.toJSON() });
}

function inject() {
  if (DY()?.view?.name !== "profile") return;
  const card = document.querySelector("#app .card.settings");
  if (!card || card.querySelector("[data-push-test]")) return;
  const box = document.createElement("div");
  box.className = "push-test";
  box.style.cssText = "margin-top:10px;display:flex;flex-direction:column;gap:6px";
  box.innerHTML = `<button type="button" class="btn sm" data-push-test data-testid="push-test">🔔 Trimite-mi o notificare de test</button><small class="muted" data-push-res></small>`;
  card.appendChild(box);
  const btn = box.querySelector("button"), res = box.querySelector("[data-push-res]");
  btn.onclick = async () => {
    btn.disabled = true; res.textContent = "Se trimite…";
    try {
      await refreshSub();
      const r = await DY().api("POST", "/api/push/test");
      if (!r.total) res.textContent = "Nu am găsit niciun telefon abonat. Pornește „Notificări” mai sus și încearcă din nou.";
      else if (r.sent) res.textContent = `Trimisă pe ${r.sent} ${r.sent === 1 ? "dispozitiv" : "dispozitive"}. Dacă nu apare în câteva secunde, verifică în setările telefonului că DYAS Poker are voie să trimită notificări${isIOS() ? " (și că modul Concentrare / Nu deranja e oprit)" : ""}.`;
      else res.textContent = `Serverul nu a putut livra notificarea (${r.errors.map((e) => `${e.host}: ${e.status || "fără răspuns"}`).join(", ")}). Oprește și pornește din nou comutatorul „Notificări”, apoi mai încearcă.`;
      if (r.errors?.length && r.sent) res.textContent += ` Pe ${r.errors.length} dispozitiv(e) nu a mers.`;
    } catch (e) { res.textContent = e.message; }
    btn.disabled = false;
  };
}
new MutationObserver(inject).observe(document.getElementById("app"), { childList: true, subtree: true });
addEventListener("hashchange", () => setTimeout(inject, 200));
