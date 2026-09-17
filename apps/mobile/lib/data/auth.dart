import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'config.dart';

/// Inloggen met een e-mailCODE, niet met een magic link.
///
/// Het web gebruikt een link (`token_hash` in een URL). In een app werkt dat slecht: de link opent
/// een browser en de sessie moet dan terug de app in. Een zescijferige code die je overtypt werkt
/// overal en op elk apparaat.
///
/// Dit praat rechtstreeks met Supabase Auth via HTTP, met de PUBLIEKE anon-sleutel. Bewust geen
/// supabase_flutter-pakket: dat sleept native plug-ins mee, en de app heeft er nu niets van nodig.
///
/// ⚠️ Twee dingen zijn nog NIET bewezen (Supabase gaf tijdens het bouwen HTTP 402):
///   1. of de e-mailtemplate `{{ .Token }}` bevat — zonder die regel mailt Supabase alleen een link
///      en komt er nooit een code aan;
///   2. of `verify` met `type: email` en een `token` van zes cijfers de sessie teruggeeft.
/// Allebei staan als eerste testpunt in APP-2.
class Auth {
  Auth({http.Client? client}) : _client = client ?? http.Client();
  final http.Client _client;

  static const _sleutelToken = 'albn_access_token';
  static const _sleutelVernieuw = 'albn_refresh_token';

  Uri _authUri(String pad) => Uri.parse('${Config.supabaseUrl}/auth/v1$pad');
  Map<String, String> get _headers => {
        'apikey': Config.supabaseAnonSleutel,
        'content-type': 'application/json',
      };

  /// Vraagt een code aan. Geeft altijd "gelukt" terug voor een onbekend adres — anders kan iemand
  /// met dit endpoint uitvinden wie er lid is (het web doet dat ook zo, auth/actions.ts:59).
  Future<void> vraagCode(String email) async {
    if (!Config.authGeconfigureerd) {
      throw StateError('SUPABASE_URL/SUPABASE_ANON_KEY ontbreken — meegeven met --dart-define.');
    }
    final r = await _client.post(
      _authUri('/otp'),
      headers: _headers,
      body: jsonEncode({'email': email.trim(), 'create_user': false}),
    );
    if (r.statusCode == 429) {
      throw ApiAuthFout('te_vaak', 'Te veel pogingen. Wacht even en probeer opnieuw.');
    }
    if (r.statusCode >= 400 && r.statusCode != 422) {
      throw ApiAuthFout('mislukt', 'Kon geen code versturen (${r.statusCode}).');
    }
  }

  /// Wisselt de code in voor een sessie en bewaart die.
  Future<String> bevestigCode(String email, String code) async {
    final r = await _client.post(
      _authUri('/verify'),
      headers: _headers,
      body: jsonEncode({'email': email.trim(), 'token': code.trim(), 'type': 'email'}),
    );
    final body = jsonDecode(r.body) as Map<String, dynamic>;
    final token = body['access_token'] as String?;
    if (r.statusCode != 200 || token == null) {
      throw ApiAuthFout('code_ongeldig', 'Deze code klopt niet of is verlopen.');
    }
    final p = await SharedPreferences.getInstance();
    await p.setString(_sleutelToken, token);
    final vernieuw = body['refresh_token'] as String?;
    if (vernieuw != null) await p.setString(_sleutelVernieuw, vernieuw);
    return token;
  }

  Future<String?> bewaardeToken() async =>
      (await SharedPreferences.getInstance()).getString(_sleutelToken);

  Future<void> logUit() async {
    final p = await SharedPreferences.getInstance();
    await p.remove(_sleutelToken);
    await p.remove(_sleutelVernieuw);
  }
}

class ApiAuthFout implements Exception {
  ApiAuthFout(this.code, this.bericht);
  final String code;
  final String bericht;
  @override
  String toString() => bericht;
}
