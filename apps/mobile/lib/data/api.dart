import 'dart:convert';
import 'package:http/http.dart' as http;
import 'config.dart';

/// Eén foutsoort voor de hele app, zodat schermen niet elk hun eigen afhandeling verzinnen.
class ApiFout implements Exception {
  ApiFout(this.code, this.bericht, {this.status});
  final String code;
  final String bericht;
  final int? status;

  /// Is dit de bekende Supabase-restrictie (HTTP 402) of een andere tijdelijke storing?
  bool get isTijdelijk => status == 503 || status == 402 || code == 'upstream_unavailable';

  @override
  String toString() => 'ApiFout($code, $status): $bericht';
}

/// Client voor /api/app/v1. Kent precies één antwoordvorm: {data: …} of {error: {code, message}}.
class Api {
  Api({http.Client? client, this.token}) : _client = client ?? http.Client();
  final http.Client _client;
  final String? token;

  Api metToken(String? t) => Api(client: _client, token: t);

  Uri _uri(String pad, [Map<String, String>? query]) =>
      Uri.parse('${Config.apiBasis}/api/app/v1$pad').replace(queryParameters: query);

  Map<String, String> get _headers => {
        'accept': 'application/json',
        if (token != null && token!.isNotEmpty) 'authorization': 'Bearer $token',
      };

  Future<Map<String, dynamic>> _get(String pad, [Map<String, String>? query]) async {
    late http.Response r;
    try {
      r = await _client.get(_uri(pad, query), headers: _headers).timeout(const Duration(seconds: 20));
    } catch (e) {
      throw ApiFout('netwerk', 'Geen verbinding met de server.', status: null);
    }
    Map<String, dynamic> body;
    try {
      body = jsonDecode(r.body) as Map<String, dynamic>;
    } catch (_) {
      throw ApiFout('ongeldig_antwoord', 'Onverwacht antwoord van de server.', status: r.statusCode);
    }
    if (r.statusCode >= 200 && r.statusCode < 300 && body['data'] != null) {
      return body['data'] as Map<String, dynamic>;
    }
    final fout = body['error'] as Map<String, dynamic>?;
    throw ApiFout(
      (fout?['code'] as String?) ?? 'onbekend',
      (fout?['message'] as String?) ?? 'Er ging iets mis.',
      status: r.statusCode,
    );
  }

  Future<Map<String, dynamic>> catalogus() => _get('/catalog');
  Future<Map<String, dynamic>> zoek(String q) => _get('/search', {'q': q});
  Future<Map<String, dynamic>> programma(String slug) => _get('/programs/$slug');
  Future<Map<String, dynamic>> ik() => _get('/me');
  Future<Map<String, dynamic>> profielen() => _get('/me/profiles');
}
