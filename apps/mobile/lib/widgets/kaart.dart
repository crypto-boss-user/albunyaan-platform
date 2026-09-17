import 'package:flutter/material.dart';
import '../data/stijl.dart';

/// Eén kaartje in een rij: miniatuur met terugval op een kleurvlak, titel eronder.
/// De kleurvlak-terugval volgt de website: die gebruikt `thumbnail_hue` als er geen
/// afbeelding is, zodat een lege plek nooit grijs-op-grijs wordt.
class Kaart extends StatelessWidget {
  const Kaart({super.key, required this.titel, this.thumbnail, this.hue, this.onderschrift, this.onTap});
  final String titel;
  final String? thumbnail;
  final num? hue;
  final String? onderschrift;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final kleur = HSLColor.fromAHSL(1, ((hue ?? 120).toDouble()) % 360, 0.48, 0.32).toColor();
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: SizedBox(
        width: 168,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: AspectRatio(
                aspectRatio: 16 / 9,
                child: thumbnail != null && thumbnail!.isNotEmpty
                    ? Image.network(thumbnail!, fit: BoxFit.cover,
                        errorBuilder: (_, _, _) => ColoredBox(color: kleur))
                    : ColoredBox(color: kleur),
              ),
            ),
            const SizedBox(height: 6),
            Text(titel, maxLines: 2, overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13.5, color: Stijl.tekst)),
            if (onderschrift != null)
              Text(onderschrift!, style: const TextStyle(fontSize: 12, color: Stijl.tekstGedempt)),
          ],
        ),
      ),
    );
  }
}
