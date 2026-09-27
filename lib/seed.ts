import type Database from 'better-sqlite3';

type SeedProduct = [name: string, min: number, max: number, category?: 'peptide' | 'blend' | 'supply', best?: number];

/**
 * Default catalog as shown on ridgelinefit.com (screenshots, Sept 2026).
 * Products between "BPC10MG+TB10MG" and "SNAP-8" were not visible in the screenshots:
 * add them from /admin/products. `best` = position in the Best Sellers grid.
 */
const CATALOG: SeedProduct[] = [
  ['BPC 157', 40.0, 60.5, 'peptide', 1],
  ['GHK-CU', 40.0, 60.5, 'peptide', 2],
  ['GLOW 70MG', 126.5, 126.5, 'blend', 3],
  ['KLOW 80MG', 154.0, 154.0, 'blend', 4],
  ['MOTS-C', 47.3, 125.4, 'peptide', 5],
  ['RETATRUTIDE', 51.7, 258.5, 'peptide', 6],
  ['SEMAGLUTIDE', 34.1, 90.2, 'peptide', 7],
  ['TIRZ GLP-2', 49.5, 207.0, 'peptide', 8],
  ['5-AMINO-1MQ', 60.5, 82.5],
  ['ACE 031', 44.0, 44.0],
  ['ACETIC ACID', 7.7, 15.5, 'supply'],
  ['ACTH 1-39', 66.0, 66.0],
  ['ADIPOTIDE', 181.5, 232.1],
  ['ADMAX', 88.0, 121.0],
  ['AHK-CU', 35.2, 66.0],
  ['AICAR', 70.4, 70.4],
  ['AOD 9604', 49.5, 88.0],
  ['ARA-290', 83.6, 83.6],
  ['B-12', 22.0, 22.0],
  ['B7-33', 62.7, 216.7],
  ['BAC WATER', 7.0, 9.0, 'supply'],
  ['BPC 15MG+TB15MG', 110.0, 110.0, 'blend'],
  ['BPC10MG+TB10MG', 92.4, 92.4, 'blend'],
  ['SNAP-8', 46.2, 46.2],
  ['SS-31', 90.2, 440.0],
  ['SURVODUTIDE', 388.3, 388.3],
  ['SYRINGES (PACK OF 10)', 12.0, 12.0, 'supply'],
  ['TB500 (THYMOSIN B4 ACETATE)', 45.0, 71.5],
  ['TESAMORELIN', 82.5, 139.7],
  ['TESAMORELIN/IPAMORELIN (TESA/IPA) -10MG/5MG', 109.75, 109.75, 'blend'],
  ['THYMALIN', 92.4, 92.4],
  ['THYMOSIN ALPHA-1', 69.0, 94.6],
  ['VIP', 57.2, 70.0],
];

// [label, batch, test date, size MB, product name to link]
const COAS: [string, string, string, number, string | null][] = [
  ['5-Amino 1MQ 50mg', '5Amino1mq50mg', '2025-11-11', 0.34, '5-AMINO-1MQ'],
  ['AOD-9604 5mg', 'N/A', '2025-11-22', 0.31, 'AOD 9604'],
  ['CJC-1295 with DAC 5mg', 'CJCWDAC5mg', '2025-11-11', 0.29, null],
  ['CJC-1295 without DAC 5mg', 'CJCWODAC5mg', '2025-11-11', 0.31, null],
  ['NAD+ 500mg', '706', '2025-10-11', 0.24, null],
  ['NAD+ 1000mg', 'Clear Cap', '2025-03-12', 0.27, null],
  ['Tirzepatide 5mg', 'N/A', '2025-12-02', 0.22, 'TIRZ GLP-2'],
  ['Tirzepatide 10mg', 'N/A', '2025-12-02', 0.23, 'TIRZ GLP-2'],
  ['Tirzepatide 15mg', 'N/A', '2025-11-22', 0.33, 'TIRZ GLP-2'],
  ['Tirzepatide 30mg', 'N/A', '2025-10-27', 0.26, 'TIRZ GLP-2'],
  ['Tirzepatide 50mg', 'N/A', '2025-11-22', 0.33, 'TIRZ GLP-2'],
  ['Tesamorelin 10mg', 'N/A', '2025-10-27', 0.27, 'TESAMORELIN'],
  ['Thymosin Alpha-1 5mg', 'N/A', '2025-11-22', 0.29, 'THYMOSIN ALPHA-1'],
];

export function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/\+/g, '-plus-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function describe(name: string, category: string) {
  if (category === 'supply') {
    return `${name}: laboratory supply item for research workflows. Sold for laboratory use only.`;
  }
  return `${name}: lyophilized research compound supplied for in vitro and controlled laboratory studies. Third-party purity testing; Certificate of Analysis available where listed. Research use only. Not for human or veterinary use.`;
}

export function seed(db: Database.Database) {
  const count = (db.prepare('SELECT COUNT(*) AS n FROM products').get() as { n: number }).n;
  if (count > 0) return;

  const insertP = db.prepare(`
    INSERT INTO products (slug, name, category, price_min, price_max, description, is_best_seller, sort_order)
    VALUES (@slug, @name, @category, @min, @max, @description, @best, @sort)`);
  const findId = db.prepare('SELECT id FROM products WHERE name = ?');
  const insertC = db.prepare(`
    INSERT INTO coas (product_id, label, batch, test_date, file_size_mb) VALUES (?, ?, ?, ?, ?)`);

  db.transaction(() => {
    CATALOG.forEach(([name, min, max, category = 'peptide', best], i) => {
      insertP.run({
        slug: slugify(name),
        name,
        category,
        min,
        max,
        description: describe(name, category),
        best: best ? 1 : 0,
        sort: best ?? 100 + i,
      });
    });
    for (const [label, batch, date, size, productName] of COAS) {
      const row = productName ? (findId.get(productName) as { id: number } | undefined) : undefined;
      insertC.run(row?.id ?? null, label, batch, date, size);
    }
  })();
}
