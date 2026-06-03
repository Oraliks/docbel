import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Eye, FileText, Calendar } from 'lucide-react';
import { getNewsStats } from '@/lib/news/stats';

// Page de stats purement présentationnelle → Server Component : les agrégations
// sont calculées côté serveur (lib partagé + micro-cache), zéro fetch client,
// zéro état de chargement côté navigateur. L'auth est assurée par le layout admin.
export default async function NewsStatsPage() {
  let stats: Awaited<ReturnType<typeof getNewsStats>>;
  try {
    stats = await getNewsStats();
  } catch (error) {
    console.error('Error fetching stats:', error);
    return (
      <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
        <div className="text-center py-12 text-muted-foreground">Erreur au chargement</div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Statistiques des articles</h1>
        <p className="text-muted-foreground mt-1">Vue d&apos;ensemble de vos articles et performances</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold mt-1">{stats.total}</p>
              </div>
              <FileText className="w-5 h-5 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Publiés</p>
                <p className="text-2xl font-bold mt-1 text-green-600">{stats.published}</p>
              </div>
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Brouillons</p>
                <p className="text-2xl font-bold mt-1">{stats.draft}</p>
              </div>
              <FileText className="w-5 h-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Planifiés</p>
                <p className="text-2xl font-bold mt-1 text-blue-600">{stats.scheduled}</p>
              </div>
              <Calendar className="w-5 h-5 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Vues totales</p>
                <p className="text-2xl font-bold mt-1">{stats.totalViews}</p>
              </div>
              <Eye className="w-5 h-5 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Most Viewed Article */}
      {stats.mostViewed && (
        <Card className="border-l-4 border-l-green-600">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">📈 Article le plus consulté</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <span className="text-2xl">{stats.mostViewed.emoji}</span>
                <div>
                  <p className="font-medium">{stats.mostViewed.title}</p>
                  <p className="text-sm text-muted-foreground">{stats.mostViewed.category}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-green-600">{stats.mostViewed.views}</p>
                <p className="text-xs text-muted-foreground">vues</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* By Category */}
      <Card>
        <CardHeader>
          <CardTitle>Articles par catégorie</CardTitle>
          <CardDescription>{stats.byCategory.length} catégorie(s)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats.byCategory.map((cat) => (
              <div key={cat.category} className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="font-medium text-sm">{cat.category}</p>
                  <p className="text-xs text-muted-foreground">{cat.count} article(s)</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{cat.views}</p>
                  <p className="text-xs text-muted-foreground">vues</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Articles */}
      <Card>
        <CardHeader>
          <CardTitle>Derniers articles</CardTitle>
          <CardDescription>Les 5 derniers articles créés</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {stats.recentArticles.map((article) => (
              <div key={article.id} className="flex items-center justify-between pb-3 border-b last:border-b-0 last:pb-0">
                <div className="flex-1">
                  <p className="font-medium text-sm">{article.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(article.createdAt).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={article.status === 'published' ? 'default' : 'secondary'}>
                    {article.status === 'published' ? 'Publié' :
                     article.status === 'draft' ? 'Brouillon' :
                     article.status === 'scheduled' ? 'Planifié' : 'Archivé'}
                  </Badge>
                  <span className="text-sm text-muted-foreground min-w-[40px] text-right">{article.views}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Stats Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Résumé</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Moyenne de vues</p>
              <p className="text-xl font-bold mt-1">{stats.avgViews}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Taux publication</p>
              <p className="text-xl font-bold mt-1">{stats.total > 0 ? Math.round((stats.published / stats.total) * 100) : 0}%</p>
            </div>
            <div>
              <p className="text-muted-foreground">Catégories</p>
              <p className="text-xl font-bold mt-1">{stats.byCategory.length}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Archivés</p>
              <p className="text-xl font-bold mt-1">{stats.archived}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
