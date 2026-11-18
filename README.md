# nepomenik

Chrome dodatak koji prepoznaje i zamagljuje lice Aleksandra Vučića u snimcima i prenosima zvaničnog YouTube kanala [@ParlamentSrbija](https://www.youtube.com/@ParlamentSrbija). Dostupne su pauza i jačina zamućenja. Otvori meni dodatka da vidiš da li je kanal potvrđen, da li se kadar čita i da li je lice prepoznato. Zvuk kontrolišeš zasebno, po želji uz [Neleceni](https://chromewebstore.google.com/detail/neleceni/ffkbnnalhdnnnaeemojkmgpajmaagnjl).

## Instalacija

1. Raspakuj ZIP.
2. U Chrome-u otvori `chrome://extensions` i uključi **Režim programera** (*Developer mode*).
3. Klikni **Učitaj raspakovano** (*Load unpacked*) i odaberi raspakovani folder koji direktno sadrži `manifest.json`.
4. Osveži već otvorene stranice. Klikni na ikonu dodatka da promeniš podešavanja. Za brzu pauzu koristi **Alt + Shift + V**. Ako je prečica zauzeta, promeni je na `chrome://extensions/shortcuts`.

## Podrška

Verzija 0.2.1 predviđena je za desktop Chrome 116+ i standardni YouTube plejer na stranici snimka ili prenosa sa kanala @ParlamentSrbija. Video se analizira u intervalima, sa praćenjem prepoznatog lica između provera. Ako se lice izgubi, privremeno se prekriva ceo video. Za prekrivanje tokom celog govora koristi Neleceni sa uključenom oznakom na plejeru i Aleksandrom Vučićem na listi govornika. Dok ta oznaka prikazuje Vučića kao utišanog govornika, nepomenik prekriva video kad nema pouzdane maske za lice. Bez oznake prekrivanje traje do 2,5 sekunde snimka posle poslednjeg prepoznavanja. Premotavanje poništava praćenje lica. Sitna lica, izražen profil, zaklonjeno lice i slabo osvetljenje smanjuju pouzdanost. DRM, Picture-in-Picture i video kojem Chrome blokira čitanje piksela nisu podržani.

## Privatnost i dozvole

Dodatak ima pristup www.youtube.com da bi proverio kanal trenutnog videa i prikazao masku u plejeru. Analiza se pokreće samo na snimcima potvrđenog kanala. Kadrovi i rezultati obrađuju se u pregledaču. Chrome lokalno čuva samo podešavanja.

## Modeli i reference

- [face-api.js 0.22.2](https://github.com/justadudewhohacks/face-api.js/tree/0.22.2), MIT. Tekst licence je u `vendor/LICENSE`.
- Referentni numerički vektori izvedeni su iz tri javno licencirane fotografije. Paket sadrži vektore. Originalne fotografije su dostupne na stranicama izvora.
- [Aleksandar Vučić (2024)](https://commons.wikimedia.org/wiki/File:Aleksandar_Vu%C4%8Di%C4%87_(2024).jpg), Oliver Bunic, European Commission, © European Union, CC BY 4.0.
- [Aleksandar Vučić 2019](https://commons.wikimedia.org/wiki/File:Aleksandar_Vu%C4%8Di%C4%87_2019.jpg), Duma.gov.ru, CC BY 4.0.
- [Aleksandar Vučić](https://commons.wikimedia.org/wiki/File:Aleksandar_Vu%C4%8Di%C4%87.jpg), Medija centar Beograd, CC BY 3.0 Unported.
