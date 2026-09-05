/**
 * GEMETEN paginatitels van de 25 categoriepagina's van de storefront (SR 4 stap 10, meting 2026-09-05, anonieme GET,
 * bron + http-status per rij in reference/storefront-2026-09/categorie-titels-2026-09-05.json). De storefront-titel is een
 * eigen (vertaald) veld: soms het Engelse label ("Age 5-9", "Channels", "Islaam NL"), soms de weergavenaam — níet afleidbaar uit
 * permalink of naam (review stap 10 I-1). Sleutel = categories.external_id (Uscreen-id). Geen data-import (founder-regel): een
 * codeconstante; een nieuwe categorie zonder meting valt terug op de weergavenaam (test bewaakt 25 == 25).
 */
export const USCREEN_CATEGORY_TITLES: Record<string, string> = {
  '128768': "Channels", // Channels Live 📡
  '128766': "Welcome to Albunyaan", // Welcome to Albunyaan 👋
  '148562': "جديد البنيان 🌟 New on Albunyaan", // جديد البنيان 🌟 New on Albunyaan
  '146947': "أناشيد 🎙️ Anasheed", // أناشيد 🎙️ Anasheed
  '172484': "العمر - Age 0-2", // العمر - Age 0-2
  '114954': "Age 0-4", // العمر - Age 2-4
  '114960': "Age 5-9", // العمر - Age 5-9
  '114963': "Age 10-16", // العمر - Age 10-16
  '116523': "Age 16+", // العمر - Age 16+
  '136278': "أعمال يدوية 🎨 Handicrafts", // أعمال يدوية 🎨 Handicrafts
  '139629': "برامج الأطفال 📺 Children's Programs", // برامج الأطفال 📺 Children's Programs
  '171557': "تربية وتعليم 📚 Essential Knowledge Kids", // تربية وتعليم 📚 Essential Knowledge Kids
  '217414': "العربية للأطفال 👦🏻🧕🏻 Arabic for Kids", // العربية للأطفال 👦🏻🧕🏻 Arabic for Kids
  '139114': "رمضانيات 🌙 Ramadaan", // رمضانيات 🌙 Ramadaan
  '125327': "New releases", // New releases
  '157682': "أيام ذي الحجة 🕋 Dhul-Hidjah", // أيام ذي الحجة 🕋 Dhul-Hidjah
  '126368': "Islaam NL", // هولندي - Nederlands
  '128188': "Islaam EN", // انجليزي - English
  '165593': "لغير الناطقين بها 🗣️ Arabic for non-native Speakers", // لغير الناطقين بها 🗣️ Arabic for non-native Speakers
  '165595': "علوم اللغة العربية 📝 Arabic Language Sciences", // علوم اللغة العربية 📝 Arabic Language Sciences
  '140917': "كن واعياً 💡Be Conscious", // كن واعياً 💡Be Conscious
  '128189': "What Every Mosilm Supposed to Know", // العلم الواجب 📔 Essential Knowledge Parents
  '128190': "Documentary", // وثائقيات 📽️ Documentary
  '156459': "تطبيقات الحماية للأطفال 🛡️Protect Your Child", // تطبيقات الحماية للأطفال 🛡️Protect Your Child
  '128333': "Apps (only for android)", // تطبيقات متنوعة 📱Apps (only for android)
};

/** Paginatitel zoals gemeten op de storefront; fallback = weergavenaam. */
export function uscreenCategoryTitle(externalId: string, fallback: string): string {
  return USCREEN_CATEGORY_TITLES[externalId] ?? fallback;
}
