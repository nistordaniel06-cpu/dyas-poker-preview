# DYAS Poker · mișcare și ritmul mâinii

Lucrează ca designer de interacțiune și dezvoltator pentru o masă de Texas Hold’em pe telefon. Folosește cele trei planșe de referință pentru orientarea cărților, traseul fiselor și accentul auriu. Derivă evenimentele din stările confirmate de server. Păstrează ordinea, sumele și vizibilitatea cărților pentru fiecare loc.

| Moment | Indicație vizuală |
| --- | --- |
| Fold | Cele două dosuri se retrag și dispar lângă locul care a renunțat. |
| Check | Un cerc auriu scurt pe postav, fără transfer de fise. |
| Call, bet, raise | Mută un teanc de la jucător în zona pariului. Păstrează suma confirmată și diferențiază mărimea teancului. |
| All-in | Accentuează locul și afișează ALL-IN. Întoarce cărțile după dezvăluirea autorizată. |
| Blinduri și ante | Animează contribuțiile obligatorii existente în starea mesei. Afișează ante doar când jocul îl percepe. |
| Distribuire | Pleacă din centrul mesei. Trimite câte o carte în două ture, începând după dealer. |
| Colectare | Strânge pariurile în centru înaintea distribuirii câștigului. |
| Flop, turn, river | Întoarce cele trei cărți de flop eșalonat. Lasă timp pentru citirea fiecărei străzi de all-in. |
| Showdown, victorie | Efect de întoarcere pentru cărțile publice, contur auriu la câștigător, apoi plata către locul corect. |
| Victorie prin fold | Plătește ultimul jucător rămas, cu dosurile cărților ascunse. |
| Egalitate | Împarte vizual plata între locurile confirmate de server. |
| Poturi secundare | Etichetează potul principal și fiecare pot secundar, apoi trimite fisele către câștigătorii acelui pot. |
| Show / muck | Reprezintă dezvăluirea sau retragerea potrivit stării publice. O decizie manuală necesită o acțiune acceptată de server. |

Folosește 2,4 secunde la pornire, 6,5 secunde între mâini și 2,6 secunde între etapele automate ale unui all-in. După river, lasă aproximativ 2,1 secunde până la rezultat. Rezervă 0,9 secunde pentru fiecare pot suplimentar. Respectă timpul de decizie configurat pentru turnee, timpul de gândire al jucătorului și preferința de mișcare redusă.

Verifică separat etichetele și pictogramele pe fundalul real al butonului. Păstrează numele și sumele lizibile, controalele active și culorile cărților distincte. Testează la 2 și la 9 locuri, inclusiv reconectare, rezultat necontestat, all-in și poturi multiple.
