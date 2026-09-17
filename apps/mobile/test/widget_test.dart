import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:albunyaan/data/api.dart';
import 'package:albunyaan/data/auth.dart';
import 'package:albunyaan/data/teksten.dart';
import 'package:albunyaan/schermen/catalogus.dart';
import 'package:albunyaan/schermen/account.dart';
import 'package:albunyaan/schermen/inloggen.dart';
import 'package:albunyaan/schermen/profielen.dart';

/// Testen zonder server: de HTTP-laag wordt vervangen door een MockClient, zodat we precies
/// bepalen wat de API teruggeeft — ook de 402/503-toestand die nu in productie geldt.
/// Zelfde delegates als de echte app (main.dart) — zonder die regel klaagt AppBar over
/// ontbrekende MaterialLocalizations zodra de locale niet Engels is.
Widget _omhuls(Widget kind, {Locale locale = const Locale('nl')}) => MaterialApp(
      locale: locale,
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: T.ondersteund.map(Locale.new).toList(),
      home: kind,
    );

Api _apiDie(String body, {int status = 200}) =>
    Api(client: MockClient((_) async => http.Response(body, status, headers: {'content-type': 'application/json'})));

void main() {
  group('Api', () {
    test('pakt data uit het omhulsel', () async {
      final api = _apiDie(jsonEncode({'data': {'rows': []}}));
      expect((await api.catalogus())['rows'], isEmpty);
    });

    test('maakt van een foutantwoord een ApiFout met code', () async {
      final api = _apiDie(jsonEncode({'error': {'code': 'not_found', 'message': 'weg'}}), status: 404);
      expect(() => api.programma('x'), throwsA(isA<ApiFout>()
          .having((e) => e.code, 'code', 'not_found')
          .having((e) => e.status, 'status', 404)));
    });

    test('503 en 402 gelden als tijdelijk — daar hoort een andere tekst bij', () async {
      for (final s in [503, 402]) {
        final api = _apiDie(jsonEncode({'error': {'code': 'upstream_unavailable', 'message': 'x'}}), status: s);
        try {
          await api.catalogus();
          fail('had moeten gooien');
        } on ApiFout catch (e) {
          expect(e.isTijdelijk, isTrue, reason: 'status $s');
        }
      }
    });

    test('onleesbaar antwoord wordt een nette fout, geen crash', () async {
      final api = _apiDie('<html>502</html>', status: 502);
      expect(() => api.catalogus(), throwsA(isA<ApiFout>().having((e) => e.code, 'code', 'ongeldig_antwoord')));
    });

    test('zonder token gaat er geen Authorization-header mee', () async {
      String? gezien;
      final api = Api(client: MockClient((req) async {
        gezien = req.headers['authorization'];
        return http.Response(jsonEncode({'data': {}}), 200);
      }));
      await api.catalogus();
      expect(gezien, isNull);
    });

    test('met token gaat de bearer-header wél mee', () async {
      String? gezien;
      final api = Api(token: 'abc.def.ghi', client: MockClient((req) async {
        gezien = req.headers['authorization'];
        return http.Response(jsonEncode({'data': {}}), 200);
      }));
      await api.ik();
      expect(gezien, 'Bearer abc.def.ghi');
    });
  });

  group('Catalogus-scherm', () {
    testWidgets('toont de rijen en hun titels', (tester) async {
      final api = _apiDie(jsonEncode({'data': {'rows': [
        {'kind': 'category', 'title': 'Tafsir', 'items': [
          {'title': 'Les 1', 'slug': 'les-1', 'thumbnail_hue': 120},
        ]},
      ]}}));
      await tester.pumpWidget(_omhuls(CatalogusScherm(api: api)));
      await tester.pumpAndSettle();
      expect(find.text('Tafsir'), findsOneWidget);
      expect(find.text('Les 1'), findsOneWidget);
    });

    testWidgets('bij de 402-toestand komt de tijdelijke tekst, niet "er ging iets mis"', (tester) async {
      final api = _apiDie(jsonEncode({'error': {'code': 'upstream_unavailable', 'message': 'x'}}), status: 503);
      await tester.pumpWidget(_omhuls(CatalogusScherm(api: api)));
      await tester.pumpAndSettle();
      expect(find.text(T('nl')('tijdelijkWeg')), findsOneWidget);
      expect(find.text(T('nl')('ietsMis')), findsNothing);
    });

    testWidgets('lege catalogus geeft de lege staat, geen foutmelding', (tester) async {
      await tester.pumpWidget(_omhuls(CatalogusScherm(api: _apiDie(jsonEncode({'data': {'rows': []}})))));
      await tester.pumpAndSettle();
      expect(find.text(T('nl')('leeg')), findsOneWidget);
    });
  });

  group('Inloggen', () {
    testWidgets('de knop blijft uit tot er een e-mailadres staat, en gaat DAARNA aan', (tester) async {
      await tester.pumpWidget(_omhuls(InloggenScherm(auth: Auth(), opIngelogd: (_) {})));
      FilledButton knop() => tester.widget<FilledButton>(find.byKey(const Key('knop-stuurcode')));
      expect(knop().onPressed, isNull, reason: 'leeg veld → uit');

      // Cubic PR #2 (17-09): hier zat de bug. Zonder rebuild bij het typen bleef de knop uit en
      // kon de gebruiker niet verder. De oude test keek alleen naar de begintoestand.
      await tester.enterText(find.byKey(const Key('veld-email')), 'iemand@example.org');
      await tester.pump();
      expect(knop().onPressed, isNotNull, reason: 'adres ingevuld → aan');

      await tester.enterText(find.byKey(const Key('veld-email')), '   ');
      await tester.pump();
      expect(knop().onPressed, isNull, reason: 'alleen spaties → weer uit');
    });
  });

  group('Arabisch', () {
    testWidgets('krijgt rechts-naar-links', (tester) async {
      await tester.pumpWidget(_omhuls(
        CatalogusScherm(api: _apiDie(jsonEncode({'data': {'rows': []}}))),
        locale: const Locale('ar'),
      ));
      await tester.pumpAndSettle();
      expect(Directionality.of(tester.element(find.byType(Scaffold))), TextDirection.rtl);
    });

    testWidgets('en Arabische teksten', (tester) async {
      expect(T('ar')('zoeken'), 'بحث');
      expect(T('nl')('zoeken'), 'Zoeken');
      expect(T('en')('zoeken'), 'Search');
    });
  });


  group('Account', () {
    testWidgets('toont "geen actief abonnement" als dat zo is', (tester) async {
      final api = _apiDie(jsonEncode({'data': {
        'member': {'id': 'p1', 'email': 'iemand@example.org', 'full_name': 'Iemand'},
        'entitlement': {'active': false},
      }}));
      await tester.pumpWidget(_omhuls(AccountScherm(api: api, opUitloggen: () async {})));
      await tester.pumpAndSettle();
      expect(find.text(T('nl')('nietActief')), findsOneWidget);
      expect(find.text('Iemand'), findsOneWidget);
    });

    testWidgets('en "actief" wanneer er wél toegang is', (tester) async {
      final api = _apiDie(jsonEncode({'data': {
        'member': {'id': 'p1', 'email': 'x@example.org', 'full_name': null},
        'entitlement': {'active': true},
      }}));
      await tester.pumpWidget(_omhuls(AccountScherm(api: api, opUitloggen: () async {})));
      await tester.pumpAndSettle();
      expect(find.text(T('nl')('actief')), findsOneWidget);
      // Zonder naam valt het scherm terug op het e-mailadres, niet op een leeg vlak.
      expect(find.text('x@example.org'), findsWidgets);
    });
  });

  group('Profielen', () {
    testWidgets('toont de profielen en of de pincode aanstaat', (tester) async {
      final api = _apiDie(jsonEncode({'data': {
        'household': {'id': 'h1'},
        'pinIngesteld': true,
        'profiles': [
          {'id': 'pr1', 'name': 'Yusuf', 'kind': 'child', 'avatar_hue': 200},
          {'id': 'pr2', 'name': 'Amina', 'kind': 'adult', 'avatar_hue': 40},
        ],
      }}));
      await tester.pumpWidget(_omhuls(ProfielenScherm(api: api)));
      await tester.pumpAndSettle();
      expect(find.text('Yusuf'), findsOneWidget);
      expect(find.text('Amina'), findsOneWidget);
      expect(find.text(T('nl')('kind')), findsOneWidget);
      expect(find.text(T('nl')('pinIngesteld')), findsOneWidget);
    });

    testWidgets('een lege of ontbrekende naam laat het scherm niet crashen', (tester) async {
      // Cubic 17-09: `?? '?'` ving alleen null; bij een lege naam gooide .characters.first.
      final api = _apiDie(jsonEncode({'data': {
        'household': {'id': 'h1'}, 'pinIngesteld': false,
        'profiles': [
          {'id': 'a', 'name': '', 'kind': 'adult', 'avatar_hue': 10},
          {'id': 'b', 'name': '   ', 'kind': 'child', 'avatar_hue': 20},
          {'id': 'c', 'kind': 'adult', 'avatar_hue': 30},
        ],
      }}));
      await tester.pumpWidget(_omhuls(ProfielenScherm(api: api)));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      expect(find.text('?'), findsNWidgets(3));
    });

    testWidgets('zonder profielen een uitleg, geen leeg scherm', (tester) async {
      final api = _apiDie(jsonEncode({'data': {'household': null, 'pinIngesteld': false, 'profiles': []}}));
      await tester.pumpWidget(_omhuls(ProfielenScherm(api: api)));
      await tester.pumpAndSettle();
      expect(find.text(T('nl')('geenProfielen')), findsOneWidget);
    });
  });
}
