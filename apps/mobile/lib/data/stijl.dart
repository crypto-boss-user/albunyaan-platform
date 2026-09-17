import 'package:flutter/material.dart';

/// Huisstijl, overgenomen uit packages/core/src/tokens.ts — de gemeten storefront
/// (Uscreen-thema "Glow": primair #447525, licht kleurenschema, lettertype Cairo).
/// Eén bron voor web en app; verandert de norm daar, dan hier mee.
class Stijl {
  static const merk = Color(0xFF447525);
  static const merkLicht = Color(0xFF5A9E32);
  static const merkZacht = Color(0xFFE8F5E0);
  static const vlak = Color(0xFFFFFFFF);
  static const vlakWarm = Color(0xFFF5F5F0);
  static const tekst = Color(0xFF1A1A1A);
  static const tekstTweede = Color(0xFF555555);
  static const tekstGedempt = Color(0xFF888888);

  static ThemeData thema() {
    final basis = ThemeData(
      colorScheme: ColorScheme.fromSeed(seedColor: merk, primary: merk, surface: vlak),
      useMaterial3: true,
      scaffoldBackgroundColor: vlak,
    );
    return basis.copyWith(
      appBarTheme: const AppBarTheme(backgroundColor: vlak, foregroundColor: tekst, elevation: 0),
      textTheme: basis.textTheme.apply(bodyColor: tekst, displayColor: tekst),
    );
  }
}
