/// Waar de app zijn gegevens haalt.
///
/// Instelbaar bij het bouwen, zodat dezelfde code tegen een lokale server, een preview of
/// productie draait zonder codewijziging:
///   flutter run --dart-define=API_BASIS=http://10.0.2.2:3012
///
/// 10.0.2.2 is vanuit de Android-emulator de host-Mac; `localhost` wijst daar naar de emulator zelf.
class Config {
  static const apiBasis = String.fromEnvironment(
    'API_BASIS',
    defaultValue: 'https://albunyaan.tv',
  );

  /// Supabase-project: alleen de PUBLIEKE anon-sleutel mag in een app. De service-role-sleutel
  /// omzeilt alle beveiliging en hoort hier nooit (change-control regel 8).
  static const supabaseUrl = String.fromEnvironment('SUPABASE_URL', defaultValue: '');
  static const supabaseAnonSleutel = String.fromEnvironment('SUPABASE_ANON_KEY', defaultValue: '');

  static bool get authGeconfigureerd => supabaseUrl.isNotEmpty && supabaseAnonSleutel.isNotEmpty;
}
