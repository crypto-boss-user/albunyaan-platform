import 'package:flutter/widgets.dart';

/// Teksten in Nederlands, Engels en Arabisch. Bewust een simpele kaart in plaats van gen-l10n:
/// de app heeft nu enkele tientallen zinnen, en dit is zonder codegeneratie te lezen en te testen.
/// Arabisch krijgt automatisch RTL via Directionality (Flutter leidt dat af uit de locale).
class T {
  T(this.taal);
  final String taal;

  static const ondersteund = ['nl', 'en', 'ar'];

  static T van(BuildContext context) => T(Localizations.localeOf(context).languageCode);

  static const _woorden = <String, Map<String, String>>{
    'appNaam':        {'nl': 'Albunyaan', 'en': 'Albunyaan', 'ar': 'البنيان'},
    'inloggen':       {'nl': 'Inloggen', 'en': 'Sign in', 'ar': 'تسجيل الدخول'},
    'email':          {'nl': 'E-mailadres', 'en': 'Email address', 'ar': 'البريد الإلكتروني'},
    'stuurCode':      {'nl': 'Stuur mij een code', 'en': 'Send me a code', 'ar': 'أرسل لي رمزًا'},
    'codeUitleg':     {'nl': 'We sturen een code van zes cijfers naar je e-mail.', 'en': 'We will email you a six-digit code.', 'ar': 'سنرسل رمزًا من ستة أرقام إلى بريدك.'},
    'code':           {'nl': 'Code', 'en': 'Code', 'ar': 'الرمز'},
    'bevestig':       {'nl': 'Bevestigen', 'en': 'Confirm', 'ar': 'تأكيد'},
    'andersEmail':    {'nl': 'Ander e-mailadres', 'en': 'Use another email', 'ar': 'بريد آخر'},
    'catalogus':      {'nl': 'Catalogus', 'en': 'Catalogue', 'ar': 'المكتبة'},
    'zoeken':         {'nl': 'Zoeken', 'en': 'Search', 'ar': 'بحث'},
    'zoekHint':       {'nl': 'Zoek een serie of les', 'en': 'Search a series or lesson', 'ar': 'ابحث عن سلسلة أو درس'},
    'geenResultaat':  {'nl': 'Niets gevonden.', 'en': 'Nothing found.', 'ar': 'لا توجد نتائج.'},
    'afleveringen':   {'nl': 'afleveringen', 'en': 'episodes', 'ar': 'حلقات'},
    'opnieuw':        {'nl': 'Opnieuw proberen', 'en': 'Try again', 'ar': 'أعد المحاولة'},
    'tijdelijkWeg':   {'nl': 'De bibliotheek is even niet bereikbaar. Probeer het zo nog eens.', 'en': 'The library is briefly unavailable. Please try again shortly.', 'ar': 'المكتبة غير متاحة مؤقتًا. حاول مرة أخرى بعد قليل.'},
    'ietsMis':        {'nl': 'Er ging iets mis.', 'en': 'Something went wrong.', 'ar': 'حدث خطأ ما.'},
    'leeg':           {'nl': 'Hier staat nog niets.', 'en': 'Nothing here yet.', 'ar': 'لا يوجد شيء هنا بعد.'},
    'spelerBinnenkort': {'nl': 'Afspelen volgt zodra het kijkplatform gekozen is.', 'en': 'Playback follows once the video platform is chosen.', 'ar': 'سيتوفر التشغيل بعد اختيار منصة الفيديو.'},
    'uitloggen':      {'nl': 'Uitloggen', 'en': 'Sign out', 'ar': 'تسجيل الخروج'},
  };

  String call(String sleutel) {
    final rij = _woorden[sleutel];
    if (rij == null) return sleutel;
    return rij[taal] ?? rij['en'] ?? sleutel;
  }
}
