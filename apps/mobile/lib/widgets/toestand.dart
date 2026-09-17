import 'package:flutter/material.dart';
import '../data/api.dart';
import '../data/teksten.dart';
import '../data/stijl.dart';

/// Eén plek voor "we zijn aan het laden", "er ging iets mis" en "hier staat niets".
/// Reden: drie schermen deden dat anders, en dan gaat de foutmelding per scherm afwijken.
class Toestand extends StatelessWidget {
  const Toestand._({this.fout, this.leeg = false, this.opnieuw});
  final Object? fout;
  final bool leeg;
  final VoidCallback? opnieuw;

  static Widget laden() => const Center(child: Padding(
        padding: EdgeInsets.all(40),
        child: CircularProgressIndicator(color: Stijl.merk),
      ));

  static Widget mislukt(Object fout, {VoidCallback? opnieuw}) =>
      Toestand._(fout: fout, opnieuw: opnieuw);

  static Widget leegScherm() => const Toestand._(leeg: true);

  @override
  Widget build(BuildContext context) {
    final t = T.van(context);
    final tijdelijk = fout is ApiFout && (fout as ApiFout).isTijdelijk;
    final bericht = leeg ? t('leeg') : (tijdelijk ? t('tijdelijkWeg') : t('ietsMis'));
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(leeg ? Icons.inbox_outlined : Icons.cloud_off_outlined,
                size: 40, color: Stijl.tekstGedempt),
            const SizedBox(height: 12),
            Text(bericht, textAlign: TextAlign.center,
                style: const TextStyle(color: Stijl.tekstTweede, fontSize: 15)),
            if (opnieuw != null) ...[
              const SizedBox(height: 16),
              FilledButton(
                style: FilledButton.styleFrom(backgroundColor: Stijl.merk),
                onPressed: opnieuw,
                child: Text(t('opnieuw')),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
