import 'package:flutter/material.dart';
import '../data/api.dart';
import '../data/stijl.dart';
import '../data/teksten.dart';
import '../widgets/toestand.dart';

/// "Wie kijkt er?" — alleen tonen. Profielen aanmaken en de pincode wijzigen gebeurt op de
/// website: dat zijn schrijfacties met ouderlijk toezicht eromheen, en die horen niet in deze
/// eerste schijf van de app.
class ProfielenScherm extends StatefulWidget {
  const ProfielenScherm({super.key, required this.api});
  final Api api;

  @override
  State<ProfielenScherm> createState() => _ProfielenSchermState();
}

class _ProfielenSchermState extends State<ProfielenScherm> {
  late Future<Map<String, dynamic>> _toekomst;

  @override
  void initState() {
    super.initState();
    _toekomst = widget.api.profielen();
  }

  @override
  Widget build(BuildContext context) {
    final t = T.van(context);
    return Scaffold(
      appBar: AppBar(title: Text(t('wieKijkt'))),
      body: FutureBuilder<Map<String, dynamic>>(
        future: _toekomst,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) return Toestand.laden();
          if (snap.hasError) {
            return Toestand.mislukt(snap.error!,
                opnieuw: () => setState(() => _toekomst = widget.api.profielen()));
          }
          final profielen = ((snap.data?['profiles'] as List?) ?? const []).cast<Map<String, dynamic>>();
          final pin = (snap.data?['pinIngesteld'] as bool?) ?? false;
          if (profielen.isEmpty) {
            return Center(child: Padding(
              padding: const EdgeInsets.all(28),
              child: Text(t('geenProfielen'), textAlign: TextAlign.center,
                  style: const TextStyle(color: Stijl.tekstTweede)),
            ));
          }
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Wrap(
                spacing: 16, runSpacing: 16,
                children: profielen.map((p) {
                  final hue = ((p['avatar_hue'] as num?) ?? 140).toDouble() % 360;
                  final isKind = p['kind'] == 'child';
                  // `?? '?'` vangt alleen null; een LEGE naam laat .characters.first gooien op een
                  // lege reeks en nam daarmee het hele scherm mee (Cubic, 17-09).
                  final naam = ((p['name'] as String?) ?? '').trim();
                  final letter = naam.isEmpty ? '?' : naam.characters.first.toUpperCase();
                  return SizedBox(
                    width: 96,
                    child: Column(children: [
                      CircleAvatar(
                        radius: 34,
                        backgroundColor: HSLColor.fromAHSL(1, hue, 0.45, 0.42).toColor(),
                        child: Text(letter,
                            style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w700)),
                      ),
                      const SizedBox(height: 6),
                      Text(naam, maxLines: 1, overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                      Text(isKind ? t('kind') : t('volwassene'),
                          style: const TextStyle(fontSize: 11, color: Stijl.tekstGedempt)),
                    ]),
                  );
                }).toList(),
              ),
              const SizedBox(height: 24),
              if (pin)
                Row(children: [
                  const Icon(Icons.lock_outline, size: 16, color: Stijl.merk),
                  const SizedBox(width: 6),
                  Text(t('pinIngesteld'), style: const TextStyle(fontSize: 13, color: Stijl.tekstTweede)),
                ]),
              const SizedBox(height: 8),
              Text(t('beheerOpWeb'), style: const TextStyle(fontSize: 12.5, color: Stijl.tekstGedempt)),
            ],
          );
        },
      ),
    );
  }
}
