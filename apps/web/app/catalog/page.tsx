import type { Metadata } from 'next';
import { getAllCategories, getCategoryRows, getFeaturedItems } from '@albunyaan/core/data';
import CatalogFilters from '../../components/CatalogFilters';
import CatalogRows from '../../components/CatalogRows';
import FeaturedSlider from '../../components/FeaturedSlider';

export const dynamic = 'force-dynamic';

/** Titel zoals gemeten (SR 2a catalog__1440__en). */
export const metadata: Metadata = { title: 'Albunyaan | Catalog' };

/**
 * /catalog zoals de storefront (SR 4 stap 9; SR 2a catalog__1440/390__en; SR 2b F-preferences): featured band
 * ("New releases") · filterbalk (Filters + zoekveld) · "Channels Live 📡" eerst · daarna alle categorieën met inhoud in
 * Uscreen-volgorde (24 op de storefront; hier zoveel als de zichtbaarheidsregel toelaat — zie getCategoryRows).
 * De storefront laadt rijen lazy (categories_page_2…5); hier server-gerenderd in één keer.
 */
export default async function CatalogPage() {
  const [rows, featured, categories] = await Promise.all([getCategoryRows(), getFeaturedItems(), getAllCategories()]);

  return (
    <>
      <FeaturedSlider items={featured} />
      <CatalogFilters categories={categories} />
      <div className="max-w-[1400px] mx-auto px-5 sm:px-8 py-10">
        <CatalogRows rows={rows} />
      </div>
    </>
  );
}
