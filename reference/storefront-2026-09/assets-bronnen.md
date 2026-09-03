# Storefront-assets op originele grootte (SR 0 punt d, aanvulling B13/B29) — gemeten 2026-09-03

Bron: publieke storefront-HTML van https://albunyaan.tv/ (anoniem; curl 13:37 CEST en gerenderde DOM 13:47 CEST) + Weglot custom_css. Bestanden zelf staan (zwaar) in `var/storefront-referentie/assets/` en op de NAS `/volume1/Albunyaan/storefront-referentie/assets/`; `assets-manifest.jsonl` ernaast.

| bestand | rol | bron-URL | bytes | afmeting | sha256 |
|---|---|---|---|---|---|
| logo-albunyaan-.1672933089.png | logo (header, srcset 99/198/396/1110xnull) | https://alpha.uscreencdn.com/images/logotypes/29322/logo-albunyaan-.1672933089.png | 8708 | 385×313 | aa471ac0bcc4a38b62748c60f0583ee923dc651b34531953ff24c5b279d173a1 |
| favicon---albunyaan.1657006478.png | favicon | https://albunyaan.tv/images/favicontypes/29322/favicon---albunyaan.1657006478.png | 595 | 48×48 | 6cbfc2c89920ded2eb551b5501c291b124cf4c94829cde2c230f362112fce5c0 |
| hero-banner-albunyaan.1720720104.jpg | hero-banner desktop (home, EN) | https://s3.us-east-1.amazonaws.com/unode1/assets%2Fpage-editor%2Fhero-banner-albunyaan.1720720104.jpg | 2725751 | 2880×1280 | dedc27af2a2cf99bd973ccb84c9f7024735f24e1b57a52134e5e91197627a2e5 |
| hero-banner-mobile.1720720201.jpg | hero-banner mobiel (home) | https://s3.us-east-1.amazonaws.com/unode1/assets%2Fpage-editor%2Fhero-banner-mobile.1720720201.jpg | 1320517 | 900×1600 | b3df257ae6594412fd782f0798294b22e569e34742c4af6c309b07b5d2b95337 |
| assets_page-editor_background.1718466357.jpg | achtergrond page-editor (home) | https://s3.us-east-1.amazonaws.com/unode1/assets%2Fpage-editor%2Fassets_page-editor_background.1718466357.jpg | 263505 | 1334×748 | 59f737daf847172b33a9368ab624a98430138678950529d3efb519bda648f4f9 |
| juistevisualisatie.1685549178.jpg | .sub-banner achtergrond (gemeten in NL-render; EN [te meten]) | https://s3.us-east-1.amazonaws.com/unode1/assets%2Fpage-editor%2Fjuistevisualisatie.1685549178.jpg | 830019 | 2880×1280 | 56aa0213dfb1acfed89f5bba0407410900177ba3b61002631689ee0730a2e41a |
| ar-banner-support-albunyaan-2024-02.jpg | .sub-banner AR via Weglot custom_css (extern WordPress, http) | http://support.albunyaan.tv/wp-content/uploads/2024/02/البنيان-صفحة-الواجهة.jpg | 459376 | 2250×1000 | 518503983c307abe847545ef5073d095b5d23de825991f9bba7f930e8050bebe |
| image.1685289189.png | page-editor afbeelding home | https://s3.us-east-1.amazonaws.com/unode1/assets%2Fpage-editor%2Fimage.1685289189.png | 186803 | 977×1029 | d134767bd706c17fe295f57fe7218e709c1cc6deda43d589e4bf7facdbd41a56 |
| sadqa.1685262162.jpeg | page-editor afbeelding home (sadaqah-blok) | https://s3.us-east-1.amazonaws.com/unode1/assets%2Fpage-editor%2Fsadqa.1685262162.jpeg | 445064 | 1024×691 | d7259db00152d75c14dfe6ef9489e69960400f63bfb574b6324e46e43ddf0f3f |
| thumpnail.1722973512.jpg | page-editor afbeelding home | https://s3.us-east-1.amazonaws.com/unode1/assets%2Fpage-editor%2Fthumpnail.1722973512.jpg | 434210 | 1004×464 | 96eb031960feddfc2099eddd2abfb42baf6f94f4ecf9ec15c7ddba748f59edab |
| hands.png | thema-afbeelding (Uscreen themes/) | https://alpha.uscreencdn.com/themes/hands.png | 189869 | 821×494 | 195190899d3ee5e123c93a0381763c43908a48264d1934fe79699263dd3357d2 |

Niet publiek bereikbaar en dus NIET gemeten (admin-only, twin Chrome buiten bereik in sessie B): eventuele hogere-resolutie originelen uit "Theme Customization", de e-mailsjablonen (B29).

Lettertype op de live storefront: **Cairo** (Google Fonts, `css2?family=Cairo:wght@400;500;600;700`), gemeten in de gerenderde home-DOM; eigen app gebruikt Inter + Playfair (delta voor SR 3/SR 4). Hoofdkleur `#447525` komt 3× voor in de gerenderde home-DOM (zelfde waarde als `packages/core/src/tokens.ts`).
