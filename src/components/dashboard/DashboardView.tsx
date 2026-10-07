import React, { useState, useMemo } from 'react';
import { useBakery } from '../../context/BakeryContext';
import {
  TrendingUp,
  Receipt,
  PiggyBank,
  AlertTriangle,
  Factory,
  Flame,
  ShoppingBag,
  ArrowUpRight,
  Sparkles,
  Layers,
  Trash2,
  Clock,
  CheckCircle2,
  Calendar,
  BarChart3,
  PieChart as PieChartIcon,
  ChevronDown,
  Download,
  FileText,
  Filter,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  StatCard,
  Modal,
  ModalBody,
  ModalFooter,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  DropdownLabel,
  ChartCard,
  AreaTrendChart,
  DonutDistributionChart,
  Badge,
  Button,
} from '../ui';
import { InventoryAlerts } from './InventoryAlerts';

export { InventoryAlerts };

export const DashboardView: React.FC = () => {
  const {
    sales,
    products,
    materials,
    productionOrders,
    losses,
    customOrders,
    currency,
    formatMoney,
    setActiveTab,
  } = useBakery();

  const [timeRange, setTimeRange] = useState<'7j' | '14j' | '30j'>('7j');
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  // Metrics calculations
  const todayStr = new Date().toISOString().slice(0, 10);
  const todaySales = sales.filter((s) => s.date.startsWith(todayStr));
  const totalSalesToday = todaySales.reduce((sum, s) => sum + s.total, 0);
  const ticketCount = todaySales.length;
  const averageBasket = ticketCount > 0 ? Math.round(totalSalesToday / ticketCount) : 0;

  // Margin calculation
  const totalCostSold = todaySales.reduce((sum, s) => {
    return (
      sum +
      s.items.reduce((itemSum, item) => {
        const prod = products.find((p) => p.id === item.productId);
        return itemSum + (prod?.costPrice || 0) * item.quantity;
      }, 0)
    );
  }, 0);

  const estimatedGrossProfit = totalSalesToday - totalCostSold;
  const grossMarginPercent =
    totalSalesToday > 0 ? Math.round((estimatedGrossProfit / totalSalesToday) * 100) : 0;

  // Production completion
  const totalBatches = productionOrders.length;
  const completedBatches = productionOrders.filter((o) => o.status === 'pret_en_rayon').length;
  const productionRate = totalBatches > 0 ? Math.round((completedBatches / totalBatches) * 100) : 0;

  // Critical stock materials
  const criticalMaterials = materials.filter((m) => m.currentStock <= m.minStockAlert);

  // Total losses today
  const todayLosses = losses.filter((l) => l.date === todayStr);
  const totalLossValue = todayLosses.reduce((sum, l) => sum + l.lossValue, 0);

  // Payment Breakdown
  const paymentBreakdown = sales.reduce((acc, sale) => {
    acc[sale.paymentMethod] = (acc[sale.paymentMethod] || 0) + sale.total;
    return acc;
  }, {} as Record<string, number>);

  // Donut chart payment data
  const paymentChartData = useMemo(() => {
    const colors: Record<string, string> = {
      especes: '#10b981', // emerald
      wave: '#0ea5e9', // sky
      orange_money: '#f97316', // orange
      mtn_money: '#eab308', // yellow
      carte: '#a855f7', // purple
      credit_b2b: '#3b82f6', // blue
    };
    const labels: Record<string, string> = {
      especes: 'Espèces',
      wave: 'Wave',
      orange_money: 'Orange Money',
      mtn_money: 'MTN',
      carte: 'Carte Bancaire',
      credit_b2b: 'Crédit B2B',
    };

    const entries = Object.entries(paymentBreakdown)
      .filter(([_, val]) => val > 0)
      .map(([method, val]) => ({
        name: labels[method] || method,
        value: val,
        color: colors[method] || '#f59e0b',
      }));

    return entries.length > 0
      ? entries
      : [{ name: 'Aucune vente', value: 1, color: '#44403c' }];
  }, [paymentBreakdown]);

  // Top products sold
  const productSalesMap = sales.reduce((acc, sale) => {
    sale.items.forEach((item) => {
      acc[item.name] = (acc[item.name] || 0) + item.quantity;
    });
    return acc;
  }, {} as Record<string, number>);

  const topProducts = Object.entries(productSalesMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // 7-day daily sales trend data from BakeryProvider state
  const last7DaysTrend = useMemo(() => {
    const latestDate = sales.reduce((latest, s) => {
      const d = s.date.slice(0, 10);
      return d > latest ? d : latest;
    }, new Date().toISOString().slice(0, 10));

    const base = new Date(latestDate);
    const dayCount = timeRange === '7j' ? 7 : timeRange === '14j' ? 14 : 30;
    const trend = [];

    for (let i = dayCount - 1; i >= 0; i--) {
      const targetDate = new Date(base);
      targetDate.setDate(base.getDate() - i);
      const dateKey = targetDate.toISOString().slice(0, 10);

      const daySales = sales.filter((s) => s.date.startsWith(dateKey));
      const revenue = daySales.reduce((acc, s) => acc + s.total, 0);
      const tickets = daySales.length;

      const dayLabel = targetDate.toLocaleDateString('fr-FR', {
        weekday: 'short',
        day: 'numeric',
      });

      trend.push({
        date: dateKey,
        day: dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1),
        revenue,
        tickets,
      });
    }

    return trend;
  }, [sales, timeRange]);

  const totalRangeRevenue = last7DaysTrend.reduce((sum, d) => sum + d.revenue, 0);
  const avgDailyRevenue = Math.round(totalRangeRevenue / (last7DaysTrend.length || 1));
  const peakDay = [...last7DaysTrend].sort((a, b) => b.revenue - a.revenue)[0];

  return (
    <div className="flex-1 p-5 md:p-8 space-y-6 overflow-y-auto bg-stone-950 text-stone-100">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-stone-900 via-stone-850 to-amber-950/40 p-6 rounded-3xl border border-stone-800 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent pointer-events-none" />
        <div className="space-y-1 relative z-10">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-stone-100">
              Tableau de Bord Fournil & Ventes
            </h1>
            <Badge variant="emerald" pulse dot>
              En direct
            </Badge>
          </div>
          <p className="text-xs text-stone-400">
            Aujourd'hui : {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* Quick Launch Actions (Using REUI Button) */}
        <div className="flex flex-wrap items-center gap-2 relative z-10">
          <Button
            onClick={() => setActiveTab('pos')}
            variant="primary"
            size="sm"
            icon={<ShoppingBag className="w-4 h-4" />}
          >
            Caisse POS
          </Button>

          <Button
            onClick={() => setActiveTab('production')}
            variant="secondary"
            size="sm"
            icon={<Flame className="w-4 h-4 text-orange-400" />}
          >
            Fournées
          </Button>

          <Button
            onClick={() => setIsReportModalOpen(true)}
            variant="outline"
            size="sm"
            icon={<FileText className="w-4 h-4 text-amber-400" />}
          >
            Rapport Flash
          </Button>

          <Button
            onClick={() => setActiveTab('ai_assistant')}
            variant="accent"
            size="sm"
            icon={<Sparkles className="w-4 h-4 text-purple-400" />}
          >
            Smart IA
          </Button>
        </div>
      </div>

      {/* KPI Cards Row (Using REUI StatCard) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Chiffre d’Affaires Jour"
          value={formatMoney(totalSalesToday)}
          subtitle={`${ticketCount} ticket(s) enregistrés`}
          trend={{ value: '+14% vs j-7', isPositive: true }}
          color="amber"
          icon={<TrendingUp className="w-4 h-4" />}
          onClick={() => setActiveTab('pos')}
        />

        <StatCard
          title="Panier Moyen"
          value={formatMoney(averageBasket)}
          subtitle="Moyenne par client comptoir"
          color="sky"
          icon={<Receipt className="w-4 h-4" />}
        />

        <StatCard
          title="Marge Brute Estimée"
          value={formatMoney(estimatedGrossProfit)}
          badge={
            <Badge variant="emerald" size="sm">
              {grossMarginPercent}%
            </Badge>
          }
          subtitle={`Coût matières : ${formatMoney(totalCostSold)}`}
          color="emerald"
          icon={<PiggyBank className="w-4 h-4" />}
        />

        <StatCard
          title="Avancement Fournil"
          value={`${productionRate}%`}
          badge={
            <Badge variant="orange" size="sm">
              {completedBatches}/{totalBatches} fournées
            </Badge>
          }
          subtitle="Taux de réalisation des OF"
          color="orange"
          icon={<Factory className="w-4 h-4" />}
          onClick={() => setActiveTab('production')}
        />
      </div>

      {/* CHARTS ROW (Using REUI ChartCard & Recharts) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart: Daily Sales Trend */}
        <div className="lg:col-span-2">
          <ChartCard
            title="Tendance des Ventes Journalières"
            badge={`Période: ${timeRange.toUpperCase()}`}
            description="Évolution du chiffre d'affaires et volume de tickets sur la période glissante"
            metrics={[
              { label: `Total ${timeRange}`, value: formatMoney(totalRangeRevenue), highlight: true },
              { label: 'Moyenne / Jour', value: formatMoney(avgDailyRevenue) },
              ...(peakDay
                ? [{ label: 'Pic Semaine', value: `${peakDay.day}`, color: 'text-emerald-400' }]
                : []),
            ]}
            action={
              <Dropdown>
                <DropdownTrigger>
                  <Button variant="outline" size="xs" icon={<Filter className="w-3.5 h-3.5" />}>
                    <span>{timeRange === '7j' ? '7 Jours' : timeRange === '14j' ? '14 Jours' : '30 Jours'}</span>
                    <ChevronDown className="w-3 h-3 text-stone-400" />
                  </Button>
                </DropdownTrigger>
                <DropdownMenu width="w-36">
                  <DropdownLabel>Échelle de temps</DropdownLabel>
                  <DropdownItem onClick={() => setTimeRange('7j')} variant={timeRange === '7j' ? 'amber' : 'default'}>
                    7 Derniers Jours
                  </DropdownItem>
                  <DropdownItem onClick={() => setTimeRange('14j')} variant={timeRange === '14j' ? 'amber' : 'default'}>
                    14 Derniers Jours
                  </DropdownItem>
                  <DropdownItem onClick={() => setTimeRange('30j')} variant={timeRange === '30j' ? 'amber' : 'default'}>
                    30 Derniers Jours
                  </DropdownItem>
                </DropdownMenu>
              </Dropdown>
            }
          >
            <AreaTrendChart
              data={last7DaysTrend}
              xKey="day"
              yKey="revenue"
              height={260}
              color="#f59e0b"
              gradientId="salesAreaGradient"
              yFormatter={(val) =>
                currency === 'EUR'
                  ? `${val} €`
                  : val >= 1000
                  ? `${Math.round(val / 1000)}k`
                  : `${val}`
              }
              tooltipFormatter={(val, _, item) => (
                <div className="bg-stone-900 border border-amber-500/50 p-3 rounded-2xl shadow-2xl text-xs space-y-1">
                  <p className="font-extrabold text-stone-100 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-amber-400" />
                    <span>{item.day} ({item.date})</span>
                  </p>
                  <p className="text-amber-400 font-black text-sm">
                    Recette : {formatMoney(val)}
                  </p>
                  <p className="text-stone-400 text-[11px]">
                    {item.tickets} ticket(s) émis
                  </p>
                </div>
              )}
            />
          </ChartCard>
        </div>

        {/* Donut Chart: Payment Distribution */}
        <div className="lg:col-span-1">
          <ChartCard
            title="Canaux de Paiement"
            badge="Répartition"
            description="Ventilation des modes de règlement"
            metrics={[{ label: 'Total Encaissé', value: formatMoney(totalSalesToday), highlight: true }]}
          >
            <div className="flex flex-col items-center">
              <DonutDistributionChart
                data={paymentChartData}
                height={190}
                innerRadius={50}
                outerRadius={75}
                valueFormatter={(val) => formatMoney(val)}
              />
              {/* Legend List */}
              <div className="grid grid-cols-2 gap-2 w-full pt-3 border-t border-stone-800 text-[11px]">
                {paymentChartData.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 truncate">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-stone-400 truncate">{item.name}:</span>
                    <strong className="text-stone-200 shrink-0">{formatMoney(item.value)}</strong>
                  </div>
                ))}
              </div>
            </div>
          </ChartCard>
        </div>
      </div>

      {/* REUI INVENTORY ALERTS (Items below minStock with immediate replenishment alert icon) */}
      <InventoryAlerts onNavigateTab={setActiveTab} />

      {/* Middle Section: Live Baking Schedule & Critical Stock Alerts (Using REUI Card) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1 & 2: Today's Baking Schedule (Fournées) */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader
              action={
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => setActiveTab('production')}
                  icon={<ArrowUpRight className="w-3.5 h-3.5 text-amber-400" />}
                  iconPosition="right"
                >
                  <span className="text-amber-400 font-bold">Gérer les OF</span>
                </Button>
              }
            >
              <CardTitle icon={<Flame className="w-5 h-5 text-amber-500" />}>
                Planning des Fournées du Jour
              </CardTitle>
              <CardDescription>Suivi direct de l'atelier de fabrication et avancement des cuissons</CardDescription>
            </CardHeader>

            <CardContent className="space-y-2.5">
              {productionOrders.slice(0, 4).map((order) => {
                const statusBadge = {
                  planifie: { label: 'Planifié', color: 'stone' as const },
                  petrissage: { label: 'Pétrissage & Pousse', color: 'amber' as const },
                  au_four: { label: 'Au Four (Cuisson)', color: 'orange' as const },
                  pret_en_rayon: { label: 'Prêt en Rayon', color: 'emerald' as const },
                  annule: { label: 'Annulé', color: 'rose' as const },
                }[order.status];

                return (
                  <div
                    key={order.id}
                    className="bg-stone-950 p-3 rounded-2xl border border-stone-850 flex items-center justify-between gap-3 hover:border-stone-750 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-stone-850 border border-stone-750 flex items-center justify-center text-lg">
                        🥖
                      </div>
                      <div>
                        <h4 className="font-bold text-xs text-stone-200">{order.productName}</h4>
                        <p className="text-[11px] text-stone-400">
                          {order.code} • Prévu : <strong>{order.targetQuantity} pcs</strong> • Shift {order.shift}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Badge variant={statusBadge.color} size="md">
                        {statusBadge.label}
                      </Badge>
                      <span className="text-xs text-stone-400 font-mono hidden sm:inline">
                        {order.scheduledTime}
                      </span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Column 3: Critical Stock & Wastage Snapshot */}
        <div className="lg:col-span-1">
          <Card className="h-full flex flex-col justify-between">
            <CardHeader
              action={
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => setActiveTab('inventory')}
                >
                  <span className="text-amber-400 font-bold">Stocks</span>
                </Button>
              }
            >
              <CardTitle icon={<AlertTriangle className="w-5 h-5 text-amber-400" />}>
                Alertes Approvisionnement
              </CardTitle>
              <CardDescription>Matières proches du seuil de rupture</CardDescription>
            </CardHeader>

            <CardContent className="space-y-3">
              {criticalMaterials.length === 0 ? (
                <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-800/40 text-center space-y-1">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto" />
                  <p className="text-xs font-bold text-emerald-300">Aucune rupture détectée</p>
                  <p className="text-[11px] text-stone-400">Stocks de farines et beurres au-dessus du seuil de sécurité.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {criticalMaterials.map((mat) => (
                    <div
                      key={mat.id}
                      className="p-2.5 rounded-xl bg-red-950/30 border border-red-900/50 flex items-center justify-between"
                    >
                      <div>
                        <h5 className="font-bold text-xs text-red-200">{mat.name}</h5>
                        <p className="text-[10px] text-stone-400">
                          Reste : <strong className="text-red-400">{mat.currentStock} {mat.unit}</strong> (Seuil: {mat.minStockAlert})
                        </p>
                      </div>
                      <Button
                        variant="danger"
                        size="xs"
                        onClick={() => setActiveTab('purchases')}
                      >
                        Commander
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>

            <CardFooter className="flex items-center justify-between">
              <div>
                <span className="text-stone-400 font-semibold flex items-center gap-1.5">
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>Pertes du Jour</span>
                </span>
                <p className="text-sm font-black text-rose-400 mt-0.5">{formatMoney(totalLossValue)}</p>
              </div>
              <Button
                variant="outline"
                size="xs"
                onClick={() => setActiveTab('losses')}
              >
                Gérer Pertes
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>

      {/* Bottom Row: Top Sales & Payment Channels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top 5 Products Card */}
        <Card>
          <CardHeader>
            <CardTitle>Top 5 Produits les Plus Vendus</CardTitle>
            <CardDescription>Classement par volume d'unités vendues</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {topProducts.map(([name, qty], index) => (
              <div
                key={name}
                className="flex items-center justify-between p-2.5 rounded-2xl bg-stone-950 border border-stone-850 text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-lg bg-stone-800 text-amber-400 font-bold flex items-center justify-center text-[11px]">
                    #{index + 1}
                  </span>
                  <span className="font-bold text-stone-200">{name}</span>
                </div>
                <Badge variant="amber" size="md">
                  {qty} vendus
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Quick Summary Card */}
        <Card>
          <CardHeader>
            <CardTitle>Synthèse Encaissements & Canaux</CardTitle>
            <CardDescription>Détail consolidé de la journée</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2.5">
            <div className="p-3 bg-stone-950 rounded-2xl border border-stone-850">
              <span className="text-[11px] text-stone-400 font-semibold">💵 Espèces Directes</span>
              <p className="text-sm font-black text-stone-100 mt-1">
                {formatMoney(paymentBreakdown['especes'] || 0)}
              </p>
            </div>
            <div className="p-3 bg-stone-950 rounded-2xl border border-stone-850">
              <span className="text-[11px] text-sky-400 font-semibold">📱 Wave Mobile</span>
              <p className="text-sm font-black text-stone-100 mt-1">
                {formatMoney(paymentBreakdown['wave'] || 0)}
              </p>
            </div>
            <div className="p-3 bg-stone-950 rounded-2xl border border-stone-850">
              <span className="text-[11px] text-orange-400 font-semibold">🍊 Orange Money</span>
              <p className="text-sm font-black text-stone-100 mt-1">
                {formatMoney(paymentBreakdown['orange_money'] || 0)}
              </p>
            </div>
            <div className="p-3 bg-stone-950 rounded-2xl border border-stone-850">
              <span className="text-[11px] text-purple-400 font-semibold">💳 Cartes & B2B</span>
              <p className="text-sm font-black text-stone-100 mt-1">
                {formatMoney((paymentBreakdown['carte'] || 0) + (paymentBreakdown['credit_b2b'] || 0))}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* REUI MODAL: FLASH ACTIVITY REPORT */}
      <Modal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        title="Rapport d’Activité Flash - BoulangeriePro"
        description="Synthèse consolidée des ventes, marges et approvisionnements"
        size="lg"
      >
        <ModalBody className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-2xl bg-stone-950 border border-stone-800">
              <span className="text-[10px] text-stone-400 uppercase">Chiffre d’Affaires Total</span>
              <p className="text-lg font-black text-amber-400">{formatMoney(totalSalesToday)}</p>
            </div>
            <div className="p-3 rounded-2xl bg-stone-950 border border-stone-800">
              <span className="text-[10px] text-stone-400 uppercase">Marge Brute Estimée</span>
              <p className="text-lg font-black text-emerald-400">{formatMoney(estimatedGrossProfit)} ({grossMarginPercent}%)</p>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-stone-950 border border-stone-800 space-y-1">
            <p className="font-bold text-stone-200">Fournées & Production</p>
            <p className="text-stone-400">
              {completedBatches} sur {totalBatches} fournées terminées ({productionRate}%).
            </p>
          </div>

          <div className="p-3 rounded-2xl bg-stone-950 border border-stone-800 space-y-1">
            <p className="font-bold text-stone-200">Alertes Stock</p>
            <p className="text-stone-400">
              {criticalMaterials.length > 0
                ? `${criticalMaterials.length} matière(s) première(s) à commander d'urgence.`
                : 'Aucune rupture de matière première signalée.'}
            </p>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" size="sm" onClick={() => setIsReportModalOpen(false)}>
            Fermer
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Download className="w-4 h-4" />}
            onClick={() => {
              window.print();
              setIsReportModalOpen(false);
            }}
          >
            Imprimer Rapport
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
};
