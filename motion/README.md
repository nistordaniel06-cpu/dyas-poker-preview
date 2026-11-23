# Galerie de victorii DYAS Poker

Pagina statică se deschide la /victories/index.html. Distribuțiile din victories/hands-6.json și hands-9.json sunt generate din Hand.showdown() și Hand.finishUncontested(). Intrarea publică a prezentării este lastResult.presentation. Mișcarea consumă distribuția din motor și nu scrie solduri.

Branchul conține frontendul compilat, evaluatorul, motorul cu metadatele de prezentare și sursele galeriei. În checkout-ul de build Arena (cu public/ și server/), victory-build.mjs se rulează după build.js și arena-build.mjs, cu fixtures.mjs și settlement.mjs în rădăcină și sursele galeriei în public/victories/. Folosiți o copie curată înaintea transformării. Testul viewport-check.cjs folosește Chromium 131 și puppeteer-core 23.10.4. În galerie, controlul Viteză încetinește doar prezentarea locală.
