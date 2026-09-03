# Weglot-instellingen van albunyaan.tv (SR 0 punt a — gemeten 2026-09-03 13:53 CEST)

Bron: `https://cdn-api-weglot.com/projects/settings?api_key=<sleutel uit de publieke paginabron>` (client-side project-instellingen; sleutel bewust niet opgenomen). De taalwisselaar op de live storefront is **Weglot** (`cdn.weglot.com/weglot.min.js`, `Weglot.initialize` in de thema-HTML); Uscreens eigen `<select id="language-dropdown">` staat in de thema-HTML in een HTML-commentaar en rendert niet.

- product: `1.0`  category: `6`  trial_ends_at: `0`  technology: `Other`  translation-versie: `{'translation': 1760521101, 'slugTranslation': 1710425654}`
- excluded_blocks: 24 regels (videotitels/catalogus uitgesloten van vertaling — 'WG support'); dynamics: 22 selectors
- language_from: `en`
- languages: `[{"language_to": "ar", "custom_code": null, "custom_name": null, "custom_local_name": null, "provider": null, "enabled": true, "automatic_translation_enabled": true, "deleted_at": null, "connect_host_destination": null, "custom_flag": null}, {"language_to": "nl", "custom_code": null, "custom_name": null, "custom_local_name": null, "provider": null, "enabled": true, "automatic_translation_enabled": true, "deleted_at": null, "connect_host_destination": null, "custom_flag": null}]`
- auto_switch: `False`  auto_switch_fallback: `None`
- excluded_paths: `[]`
- excluded_blocks: `[{"value": ".card-title", "description": "video title - WG support"}, {"value": "#catalog_content > div > div:nth-child(4) > div > div > ds-swiper > swiper-slide:nth-child(4) > a.card-title", "description": "video title 2 - WG support"}, {"value": "#catalog_content > div > div:nth-child(4) > div > div > ds-swiper", "description": "catalog_content - WG support"}, {"value": ".text-ds-title-2-semi-bold", "description": "Playlist overview"}, {"value": ".program-title", "description": "after click on the video"}, {"value": ".text-ds-tiny-regular", "description": "Resources"}, {"value": ".category-title", "description": "Category name"}, {"value": "div.items-stretch:nth-child(1) > div:nth-child(1) > video-player:nth-child(2) > video-controls:nth-child(4)", "description": "video controller"}, {"v`
- dynamics: `[{"value": "#catalog_content"}, {"value": ".slide-container"}, {"value": "#text"}, {"value": ".text-ds-title-2-semi-bold"}, {"value": ".mt-2 lg:mt-0"}, {"value": ".text-ds-default"}, {"value": ".button"}, {"value": ".center"}, {"value": ".with-after"}, {"value": ".button-content"}, {"value": ".editor-content"}, {"value": ".card-title"}, {"value": ".border"}, {"value": ".program-title.cbt-title.fle`
- button_style: `{"with_name": false, "full_name": false, "is_dropdown": false, "with_flags": false, "flag_type": null}`

## custom_css (letterlijk)

```css
html[lang="ar"] .sub-banner{
  background: url("http://support.albunyaan.tv/wp-content/uploads/2024/02/البنيان-صفحة-الواجهة.jpg") no-repeat !important;
  background-size: 90%!important;
  background-position: center!important;
}

@media only screen and (max-width: 1320px) {
  html[lang="ar"] .sub-banner{
    background-size: 90%!important;
  }
}

@media only screen and (max-width: 600px) {
 html[lang="ar"]  .sub-banner{
    background: url("http://support.albunyaan.tv/wp-content/uploads/2024/02/Albunyaan-sadaqah-AR-900x1600-1.png") no-repeat !important;
    background-size: 100%!important;
    padding: 100% 0% !important; 
  }
}

html[lang="ar"] body {
  direction: RTL !important;
  text-align: right !important;
}

html[lang="ar"].items-start {
align-items: end !important;
}

html[lang="ar"] .left {
  text-align: right !mportant;
}
html[lang="ar"] .et_pb_text_1_tb_body h3 {
  direction: rtl !important;
  text-align: right !important;
}

@media (min-width: 768px){
  html[lang="ar"] #page > div > div:nth-child(5) > section > div > div > div.md\:w-1\/2.image-text--image.order-1.md\:pr-20{
  	padding: 0 !important;
  }
}
@media (min-width: 768px){
	html[lang="ar"] #page > div > div:nth-child(5) > section > div > div > div.md\:w-1\/2.image-text--image.order-1.md\:pr-20 > div > div > figure > img{
      padding-left: 5rem !important;
	}
}

html[lang="ar"] div.flex.items-stretch.md\:flex-row.md\:flex-wrap.flex-col.flex-nowrap.max-w-full {
	direction: LTR !important;
	text-align: left !important;
}
```

Gemeten gedrag (headless, `Weglot.switchTo`): AR zet `html lang=ar` maar **dir blijft ltr** (geen RTL-flip); h1 wordt "منصة البنيان" (eigen vertaling, niet letterlijk); h3-blokken blijven Engels; "Download apps" blijft Engels in AR. NL: h1 "Ik wil mijn islamitische identiteit beschermen", menu/footer vertaald. AR-sub-banner komt via custom_css van `http://support.albunyaan.tv/wp-content/uploads/2024/02/…jpg` (WordPress, http, 459.376 bytes, 200).
