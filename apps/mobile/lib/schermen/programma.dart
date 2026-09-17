import 'package:flutter/material.dart';
import '../data/api.dart';
import '../data/stijl.dart';
import '../data/teksten.dart';
import '../widgets/toestand.dart';

/// Eén programma: een serie met afleveringen, of een losse video.
/// De speler zit hier bewust NIET in — een speel-URL hoort achter een entitlement-controle en
/// wordt serverkant ondertekend, en dat wacht op de kijkplatformkeuze (K1).
class ProgrammaScherm extends StatefulWidget {
  const ProgrammaScherm({super.key, required this.api, required this.slug});
  final Api api;
  final String slug;

  @override
  State<ProgrammaScherm> createState() => _ProgrammaSchermState();
}

class _ProgrammaSchermState extends State<ProgrammaScherm> {
  late Future<Map<String, dynamic>> _toekomst;

  @override
  void initState() {
    super.initState();
    _toekomst = widget.api.programma(widget.slug);
  }

  @override
  Widget build(BuildContext context) {
    final t = T.van(context);
    return Scaffold(
      appBar: AppBar(),
      body: FutureBuilder<Map<String, dynamic>>(
        future: _toekomst,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) return Toestand.laden();
          if (snap.hasError) {
            return Toestand.mislukt(snap.error!,
                opnieuw: () => setState(() => _toekomst = widget.api.programma(widget.slug)));
          }
          final p = snap.data?['program'] as Map<String, dynamic>?;
          if (p == null) return Toestand.leegScherm();

          final isSerie = p['kind'] == 'series';
          final kern = (isSerie ? p['collection'] : p['video']) as Map<String, dynamic>?;
          if (kern == null) return Toestand.leegScherm();
          final afleveringen = ((kern['episodes'] as List?) ?? const []).cast<Map<String, dynamic>>();
          final cover = kern['cover'] as String?;
          final hue = (kern['thumbnail_hue'] as num?) ?? 120;

          return ListView(
            children: [
              AspectRatio(
                aspectRatio: 16 / 9,
                child: cover != null && cover.isNotEmpty
                    ? Image.network(cover, fit: BoxFit.cover,
                        errorBuilder: (_, _, _) => _Vlak(hue: hue))
                    : _Vlak(hue: hue),
              ),
              Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text((kern['title'] as String?) ?? '',
                        style: const TextStyle(fontSize: 21, fontWeight: FontWeight.w700)),
                    if (isSerie) ...[
                      const SizedBox(height: 4),
                      Text('${afleveringen.length} ${t('afleveringen')}',
                          style: const TextStyle(color: Stijl.tekstGedempt, fontSize: 13)),
                    ],
                    if ((kern['short_description'] as String?)?.isNotEmpty ?? false) ...[
                      const SizedBox(height: 10),
                      Text(kern['short_description'] as String,
                          style: const TextStyle(color: Stijl.tekstTweede, height: 1.5)),
                    ],
                    const SizedBox(height: 16),
                    Container(
                      key: const Key('speler-binnenkort'),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                          color: Stijl.merkZacht, borderRadius: BorderRadius.circular(8)),
                      child: Row(children: [
                        const Icon(Icons.play_circle_outline, color: Stijl.merk, size: 20),
                        const SizedBox(width: 8),
                        Expanded(child: Text(t('spelerBinnenkort'),
                            style: const TextStyle(fontSize: 13, color: Stijl.tekst))),
                      ]),
                    ),
                  ],
                ),
              ),
              ...afleveringen.map((a) => ListTile(
                    leading: const Icon(Icons.play_arrow_outlined, color: Stijl.tekstGedempt),
                    title: Text((a['title'] as String?) ?? '',
                        maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 14.5)),
                    subtitle: _duur(a['duration_seconds']) == null
                        ? null
                        : Text(_duur(a['duration_seconds'])!,
                            style: const TextStyle(fontSize: 12, color: Stijl.tekstGedempt)),
                  )),
              const SizedBox(height: 24),
            ],
          );
        },
      ),
    );
  }

  static String? _duur(Object? seconden) {
    if (seconden is! num || seconden <= 0) return null;
    final m = (seconden / 60).floor();
    return m < 60 ? '$m min' : '${(m / 60).floor()} u ${m % 60} min';
  }
}

class _Vlak extends StatelessWidget {
  const _Vlak({required this.hue});
  final num hue;
  @override
  Widget build(BuildContext context) =>
      ColoredBox(color: HSLColor.fromAHSL(1, hue.toDouble() % 360, 0.48, 0.32).toColor());
}
