import 'package:flutter/material.dart';
import '../data/auth.dart';
import '../data/stijl.dart';
import '../data/teksten.dart';

/// Inloggen in twee stappen: e-mail → code. Geen wachtwoord, geen magic link.
class InloggenScherm extends StatefulWidget {
  const InloggenScherm({super.key, required this.auth, required this.opIngelogd});
  final Auth auth;
  final void Function(String token) opIngelogd;

  @override
  State<InloggenScherm> createState() => _InloggenSchermState();
}

class _InloggenSchermState extends State<InloggenScherm> {
  final _email = TextEditingController();
  final _code = TextEditingController();
  bool _codeGevraagd = false;
  bool _bezig = false;
  String? _fout;

  @override
  void initState() {
    super.initState();
    // Zonder deze twee luisteraars bouwt het scherm niet opnieuw bij het typen, en blijft de knop
    // uitgeschakeld terwijl er wél een adres staat — de gebruiker kan dan niet verder (Cubic, 17-09).
    _email.addListener(_hertekenen);
    _code.addListener(_hertekenen);
  }

  void _hertekenen() => setState(() {});

  @override
  void dispose() {
    _email.removeListener(_hertekenen);
    _code.removeListener(_hertekenen);
    _email.dispose();
    _code.dispose();
    super.dispose();
  }

  Future<void> _doe(Future<void> Function() actie) async {
    setState(() { _bezig = true; _fout = null; });
    try {
      await actie();
    } on ApiAuthFout catch (e) {
      if (mounted) setState(() => _fout = e.bericht);
    } catch (_) {
      if (mounted) setState(() => _fout = T.van(context)('ietsMis'));
    } finally {
      if (mounted) setState(() => _bezig = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = T.van(context);
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 380),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(t('appNaam'),
                      textAlign: TextAlign.center,
                      style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w700, color: Stijl.merk)),
                  const SizedBox(height: 28),
                  if (!_codeGevraagd) ...[
                    TextField(
                      key: const Key('veld-email'),
                      controller: _email,
                      keyboardType: TextInputType.emailAddress,
                      autocorrect: false,
                      decoration: InputDecoration(labelText: t('email'), border: const OutlineInputBorder()),
                    ),
                    const SizedBox(height: 8),
                    Text(t('codeUitleg'), style: const TextStyle(fontSize: 13, color: Stijl.tekstGedempt)),
                    const SizedBox(height: 16),
                    FilledButton(
                      key: const Key('knop-stuurcode'),
                      style: FilledButton.styleFrom(backgroundColor: Stijl.merk, minimumSize: const Size.fromHeight(48)),
                      onPressed: _bezig || _email.text.trim().isEmpty
                          ? null
                          : () => _doe(() async {
                                await widget.auth.vraagCode(_email.text);
                                if (mounted) setState(() => _codeGevraagd = true);
                              }),
                      child: _bezig ? const _Spinner() : Text(t('stuurCode')),
                    ),
                  ] else ...[
                    TextField(
                      key: const Key('veld-code'),
                      controller: _code,
                      keyboardType: TextInputType.number,
                      maxLength: 6,
                      decoration: InputDecoration(labelText: t('code'), border: const OutlineInputBorder()),
                    ),
                    FilledButton(
                      key: const Key('knop-bevestig'),
                      style: FilledButton.styleFrom(backgroundColor: Stijl.merk, minimumSize: const Size.fromHeight(48)),
                      onPressed: _bezig || _code.text.trim().length < 6
                          ? null
                          : () => _doe(() async {
                                final token = await widget.auth.bevestigCode(_email.text, _code.text);
                                widget.opIngelogd(token);
                              }),
                      child: _bezig ? const _Spinner() : Text(t('bevestig')),
                    ),
                    TextButton(
                      onPressed: _bezig ? null : () => setState(() { _codeGevraagd = false; _code.clear(); }),
                      child: Text(t('andersEmail')),
                    ),
                  ],
                  if (_fout != null) ...[
                    const SizedBox(height: 14),
                    Text(_fout!, key: const Key('foutmelding'), textAlign: TextAlign.center,
                        style: const TextStyle(color: Color(0xFFB3261E), fontSize: 13.5)),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Spinner extends StatelessWidget {
  const _Spinner();
  @override
  Widget build(BuildContext context) => const SizedBox(
      height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white));
}
