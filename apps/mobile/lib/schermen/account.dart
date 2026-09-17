import 'package:flutter/material.dart';
import '../data/api.dart';
import '../data/stijl.dart';
import '../data/teksten.dart';
import '../widgets/toestand.dart';
import 'profielen.dart';

/// Account: wie ben ik en mag ik kijken. Bewust smal — de app toont geen adres, geen
/// betaalgegevens en geen Stripe-id's; die staan ook niet in het /me-antwoord (B82).
class AccountScherm extends StatefulWidget {
  const AccountScherm({super.key, required this.api, required this.opUitloggen});
  final Api api;
  final Future<void> Function() opUitloggen;

  @override
  State<AccountScherm> createState() => _AccountSchermState();
}

class _AccountSchermState extends State<AccountScherm> {
  late Future<Map<String, dynamic>> _toekomst;

  @override
  void initState() {
    super.initState();
    _toekomst = widget.api.ik();
  }

  @override
  Widget build(BuildContext context) {
    final t = T.van(context);
    return Scaffold(
      appBar: AppBar(title: Text(t('account'))),
      body: FutureBuilder<Map<String, dynamic>>(
        future: _toekomst,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) return Toestand.laden();
          if (snap.hasError) {
            return Toestand.mislukt(snap.error!, opnieuw: () => setState(() => _toekomst = widget.api.ik()));
          }
          final lid = (snap.data?['member'] as Map<String, dynamic>?) ?? const {};
          final actief = ((snap.data?['entitlement'] as Map<String, dynamic>?)?['active'] as bool?) ?? false;
          return ListView(
            children: [
              const SizedBox(height: 8),
              ListTile(
                leading: const Icon(Icons.person_outline, color: Stijl.merk),
                title: Text((lid['full_name'] as String?) ?? (lid['email'] as String?) ?? '—',
                    style: const TextStyle(fontWeight: FontWeight.w600)),
                subtitle: Text((lid['email'] as String?) ?? ''),
              ),
              const Divider(height: 1),
              ListTile(
                key: const Key('rij-abonnement'),
                leading: Icon(actief ? Icons.check_circle_outline : Icons.info_outline,
                    color: actief ? Stijl.merk : Stijl.tekstGedempt),
                title: Text(t('abonnement')),
                subtitle: Text(actief ? t('actief') : t('nietActief')),
              ),
              const Divider(height: 1),
              ListTile(
                key: const Key('rij-profielen'),
                leading: const Icon(Icons.people_outline, color: Stijl.tekstTweede),
                title: Text(t('wieKijkt')),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => ProfielenScherm(api: widget.api))),
              ),
              const Divider(height: 1),
              const SizedBox(height: 16),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: OutlinedButton.icon(
                  key: const Key('knop-uitloggen'),
                  icon: const Icon(Icons.logout, size: 18),
                  label: Text(t('uitloggen')),
                  onPressed: () async {
                    final navigator = Navigator.of(context);
                    await widget.opUitloggen();
                    navigator.pop();
                  },
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
