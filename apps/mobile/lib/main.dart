import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'data/api.dart';
import 'data/auth.dart';
import 'data/stijl.dart';
import 'data/teksten.dart';
import 'schermen/catalogus.dart';
import 'schermen/account.dart';
import 'schermen/inloggen.dart';

void main() => runApp(const AlbunyaanApp());

class AlbunyaanApp extends StatefulWidget {
  const AlbunyaanApp({super.key});

  @override
  State<AlbunyaanApp> createState() => _AlbunyaanAppState();
}

class _AlbunyaanAppState extends State<AlbunyaanApp> {
  final _auth = Auth();
  String? _token;
  bool _gecontroleerd = false;

  @override
  void initState() {
    super.initState();
    _auth.bewaardeToken().then((t) {
      if (mounted) setState(() { _token = t; _gecontroleerd = true; });
    }).catchError((_) {
      if (mounted) setState(() => _gecontroleerd = true);
    });
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Albunyaan',
      debugShowCheckedModeBanner: false,
      theme: Stijl.thema(),
      // Arabisch krijgt hiermee automatisch RTL: Flutter leidt de leesrichting af uit de locale.
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: T.ondersteund.map(Locale.new).toList(),
      home: !_gecontroleerd
          ? const Scaffold(body: Center(child: CircularProgressIndicator(color: Stijl.merk)))
          // De catalogus is publiek (net als op het web); inloggen is nodig voor kijken en account.
          : CatalogusScherm(
              api: Api(token: _token),
              ingelogd: _token != null,
              opAccount: _accountActie,
            ),
    );
  }

  /// Eén knop, twee betekenissen: het accountscherm als er een sessie is, anders inloggen.
  Future<void> _accountActie(BuildContext context) async {
    if (_token != null) {
      await Navigator.of(context).push(MaterialPageRoute(
        builder: (_) => AccountScherm(
          api: Api(token: _token),
          opUitloggen: () async {
            await _auth.logUit();
            if (mounted) setState(() => _token = null);
          },
        ),
      ));
      return;
    }
    final navigator = Navigator.of(context);
    await navigator.push(MaterialPageRoute(
      builder: (_) => InloggenScherm(
        auth: _auth,
        opIngelogd: (t) {
          setState(() => _token = t);
          navigator.pop();
        },
      ),
    ));
  }
}
