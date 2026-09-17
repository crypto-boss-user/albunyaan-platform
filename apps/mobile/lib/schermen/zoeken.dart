import 'package:flutter/material.dart';
import '../data/api.dart';
import '../data/stijl.dart';
import '../data/teksten.dart';
import '../widgets/toestand.dart';
import 'programma.dart';

/// Zoeken. De server bepaalt de ondergrens (2 tekens) en geeft dan `reason: query_too_short`;
/// de app hoeft die regel dus niet te dupliceren.
class ZoekenScherm extends StatefulWidget {
  const ZoekenScherm({super.key, required this.api});
  final Api api;

  @override
  State<ZoekenScherm> createState() => _ZoekenSchermState();
}

class _ZoekenSchermState extends State<ZoekenScherm> {
  final _veld = TextEditingController();
  Future<Map<String, dynamic>>? _toekomst;

  @override
  void dispose() {
    _veld.dispose();
    super.dispose();
  }

  void _zoek() {
    final q = _veld.text.trim();
    if (q.isEmpty) return;
    setState(() => _toekomst = widget.api.zoek(q));
  }

  @override
  Widget build(BuildContext context) {
    final t = T.van(context);
    return Scaffold(
      appBar: AppBar(
        title: TextField(
          key: const Key('veld-zoeken'),
          controller: _veld,
          autofocus: true,
          textInputAction: TextInputAction.search,
          onSubmitted: (_) => _zoek(),
          decoration: InputDecoration(hintText: t('zoekHint'), border: InputBorder.none),
        ),
        actions: [IconButton(icon: const Icon(Icons.arrow_forward), onPressed: _zoek)],
      ),
      body: _toekomst == null
          ? const SizedBox.shrink()
          : FutureBuilder<Map<String, dynamic>>(
              future: _toekomst,
              builder: (context, snap) {
                if (snap.connectionState != ConnectionState.done) return Toestand.laden();
                if (snap.hasError) return Toestand.mislukt(snap.error!, opnieuw: _zoek);
                final d = snap.data ?? const {};
                final series = ((d['series'] as List?) ?? const []).cast<Map<String, dynamic>>();
                final afleveringen = ((d['episodes'] as List?) ?? const []).cast<Map<String, dynamic>>();
                if (series.isEmpty && afleveringen.isEmpty) {
                  return Center(child: Padding(
                    padding: const EdgeInsets.all(28),
                    child: Text(t('geenResultaat'),
                        style: const TextStyle(color: Stijl.tekstTweede)),
                  ));
                }
                return ListView(children: [
                  ...series.map((s) => ListTile(
                        leading: const Icon(Icons.collections_bookmark_outlined, color: Stijl.merk),
                        title: Text((s['title'] as String?) ?? ''),
                        subtitle: Text('${s['episodeCount'] ?? 0} ${t('afleveringen')}'),
                        onTap: s['slug'] == null
                            ? null
                            : () => Navigator.of(context).push(MaterialPageRoute(
                                builder: (_) => ProgrammaScherm(api: widget.api, slug: s['slug'] as String))),
                      )),
                  ...afleveringen.map((a) => ListTile(
                        leading: const Icon(Icons.play_arrow_outlined, color: Stijl.tekstGedempt),
                        title: Text((a['title'] as String?) ?? ''),
                        onTap: a['slug'] == null
                            ? null
                            : () => Navigator.of(context).push(MaterialPageRoute(
                                builder: (_) => ProgrammaScherm(api: widget.api, slug: a['slug'] as String))),
                      )),
                ]);
              },
            ),
    );
  }
}
