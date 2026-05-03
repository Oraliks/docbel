/**
 * Utility for exporting news articles to CSV format
 */

interface NewsArticle {
  id: string;
  title: string;
  category: string;
  status: string;
  publishedAt: string | null;
  views: number;
  readingTime?: number;
  createdAt: string;
  featured?: boolean;
}

export const exportNewsToCsv = (
  articles: NewsArticle[],
  selectedColumns: string[] = ['title', 'category', 'status', 'published', 'views', 'readingTime', 'featured']
) => {
  // Define all possible columns
  const allColumns = {
    title: 'Titre',
    category: 'Catégorie',
    status: 'Statut',
    published: 'Publié',
    views: 'Vues',
    readingTime: 'Temps de lecture',
    featured: 'Vedette'
  };

  // Build headers based on selected columns
  const headers = selectedColumns
    .filter(col => col in allColumns)
    .map(col => allColumns[col as keyof typeof allColumns]);

  // Format rows based on selected columns
  const rows = articles.map(a => {
    const rowData: string[] = [];

    selectedColumns.forEach(col => {
      switch (col) {
        case 'title':
          rowData.push(`"${a.title.replace(/"/g, '""')}"`);
          break;
        case 'category':
          rowData.push(a.category);
          break;
        case 'status':
          rowData.push(a.status === 'published' ? 'Publié' : a.status === 'draft' ? 'Brouillon' : a.status === 'scheduled' ? 'Planifié' : 'Archivé');
          break;
        case 'published':
          rowData.push(a.publishedAt ? new Date(a.publishedAt).toLocaleDateString('fr-FR') : '-');
          break;
        case 'views':
          rowData.push(String(a.views));
          break;
        case 'readingTime':
          rowData.push(a.readingTime ? `${a.readingTime} min` : '-');
          break;
        case 'featured':
          rowData.push(a.featured ? 'Oui' : 'Non');
          break;
      }
    });

    return rowData;
  });

  // Combine headers and rows
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  const timestamp = new Date().toISOString().split('T')[0];
  link.setAttribute('href', url);
  link.setAttribute('download', `articles-${timestamp}.csv`);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
