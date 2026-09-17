import 'package:flutter/material.dart';
import '../data/api.dart';
import '../data/stijl.dart';
import '../data/teksten.dart';
import '../widgets/kaart.dart';
import '../widgets/toestand.dart';
import 'programma.dart';
import 'zoeken.dart';

/// De catalogus: dezelfde samenstelling als de website (rijen per categorie).
class CatalogusScherm extends StatefulWidget {
  const CatalogusScherm({super.key, required this.api, this.ingelogd = false, this.opAccount});
  final Api api;
  final bool ingelogd;
  final Future<void> Function(BuildContext context)? opAccount;

  @override
  State<CatalogusScherm> createState() => _CatalogusSchermState();
}

class _CatalogusSchermState extends State<CatalogusScherm> {
  late Future<Map<String, dynamic>> _toekomst;

  @override
  void initState() {
    super.initState();
    _toekomst = widget.api.catalogus();
  }

  void _herlaad() => setState(() => _toekomst = widget.api.catalogus());

  @override
  Widget build(BuildContext context) {
    final t = T.van(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(t('catalogus')),
        actions: [
          IconButton(
            key: const Key('knop-zoeken'),
            icon: const Icon(Icons.search),
            tooltip: t('zoeken'),
            onPressed: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => ZoekenScherm(api: widget.api))),
          ),
          if (widget.opAccount != null)
            IconButton(
              key: const Key('knop-account'),
              icon: const Icon(Icons.person_outline),
              tooltip: widget.ingelogd ? t('account') : t('inloggen'),
              onPressed: () => widget.opAccount!(context),
            ),
        ],
      ),
      body: FutureBuilder<Map<String, dynamic>>(
        future: _toekomst,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) return Toestand.laden();
          if (snap.hasError) return Toestand.mislukt(snap.error!, opnieuw: _herlaad);
          final rijen = (snap.data?['rows'] as List?) ?? const [];
          if (rijen.isEmpty) return Toestand.leegScherm();
          return RefreshIndicator(
            color: Stijl.merk,
            onRefresh: () async => _herlaad(),
            child: ListView.builder(
              padding: const EdgeInsets.symmetric(vertical: 8),
              itemCount: rijen.length,
              itemBuilder: (context, i) => _Rij(rij: rijen[i] as Map<String, dynamic>, api: widget.api),
            ),
          );
        },
      ),
    );
  }
}

class _Rij extends StatelessWidget {
  const _Rij({required this.rij, required this.api});
  final Map<String, dynamic> rij;
  final Api api;

  /// Een rij draagt afhankelijk van zijn soort `items` of `videos`.
  List<Map<String, dynamic>> get _kaarten {
    for (final sleutel in ['items', 'videos']) {
      final l = rij[sleutel];
      if (l is List && l.isNotEmpty) return l.cast<Map<String, dynamic>>();
    }
    return const [];
  }

  @override
  Widget build(BuildContext context) {
    final kaarten = _kaarten;
    if (kaarten.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsetsDirectional.only(start: 16, top: 14, bottom: 8, end: 16),
          child: Text((rij['title'] as String?) ?? '',
              style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: Stijl.tekst)),
        ),
        SizedBox(
          height: 152,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            itemCount: kaarten.length,
            separatorBuilder: (_, _) => const SizedBox(width: 12),
            itemBuilder: (context, i) {
              final k = kaarten[i];
              final slug = k['slug'] as String?;
              return Kaart(
                titel: (k['title'] as String?) ?? '',
                thumbnail: k['thumbnail_url'] as String?,
                hue: k['thumbnail_hue'] as num?,
                onTap: slug == null
                    ? null
                    : () => Navigator.of(context).push(MaterialPageRoute(
                        builder: (_) => ProgrammaScherm(api: api, slug: slug))),
              );
            },
          ),
        ),
      ],
    );
  }
}
