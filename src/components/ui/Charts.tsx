import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { Calendar } from 'lucide-react';

// 1. REUSABLE AREA CHART (DAILY SALES TREND)
export interface DailyTrendItem {
  date: string;
  day: string;
  revenue: number;
  tickets: number;
  [key: string]: any;
}

export interface DailySalesAreaChartProps {
  data: any[];
  xKey?: string;
  yKey?: string;
  height?: number;
  currency?: string;
  color?: string;
  gradientId?: string;
  formatMoney?: (val: number) => string;
  yFormatter?: (val: number) => string;
  tooltipFormatter?: (val: any, name: any, item: any) => React.ReactNode;
}

export const DailySalesAreaChart: React.FC<DailySalesAreaChartProps> = ({
  data,
  xKey = 'day',
  yKey = 'revenue',
  height = 280,
  currency = 'XOF',
  color = '#f59e0b',
  gradientId = 'reuiAmberGradient',
  formatMoney = (v) => `${v} FCFA`,
  yFormatter,
  tooltipFormatter,
}) => {
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.4} />
              <stop offset="95%" stopColor={color} stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#292524" vertical={false} />
          <XAxis
            dataKey={xKey}
            stroke="#a8a29e"
            tick={{ fill: '#a8a29e', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: '#44403c' }}
          />
          <YAxis
            stroke="#a8a29e"
            tick={{ fill: '#a8a29e', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(val: number) => {
              if (yFormatter) return yFormatter(val);
              return currency === 'EUR'
                ? `${val} €`
                : val >= 1000
                ? `${Math.round(val / 1000)}k`
                : `${val}`;
            }}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const item = payload[0].payload;
                const val = payload[0].value as number;
                if (tooltipFormatter) {
                  return tooltipFormatter(val, payload[0].name, item);
                }
                return (
                  <div className="bg-stone-900 border border-amber-500/50 p-3 rounded-2xl shadow-2xl text-xs space-y-1">
                    <p className="font-extrabold text-stone-100 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-amber-400" />
                      <span>{item[xKey]} {item.date ? `(${item.date})` : ''}</span>
                    </p>
                    <p className="text-amber-400 font-black text-sm">
                      Recette : {formatMoney(val)}
                    </p>
                    {item.tickets !== undefined && (
                      <p className="text-stone-400 text-[11px]">
                        {item.tickets} ticket(s) émis
                      </p>
                    )}
                  </div>
                );
              }
              return null;
            }}
          />
          <Area
            type="monotone"
            dataKey={yKey}
            name="Chiffre d'Affaires"
            stroke={color}
            strokeWidth={3}
            fill={`url(#${gradientId})`}
            activeDot={{ r: 6, fill: color, stroke: '#1c1917', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

// 2. REUSABLE CATEGORY SALES BAR CHART
export interface CategorySalesItem {
  category: string;
  count: number;
  revenue: number;
}

interface CategorySalesBarChartProps {
  data: CategorySalesItem[];
  height?: number;
  formatMoney: (val: number) => string;
}

export const CategorySalesBarChart: React.FC<CategorySalesBarChartProps> = ({
  data,
  height = 240,
  formatMoney,
}) => {
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#292524" vertical={false} />
          <XAxis
            dataKey="category"
            stroke="#a8a29e"
            tick={{ fill: '#a8a29e', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: '#44403c' }}
          />
          <YAxis
            stroke="#a8a29e"
            tick={{ fill: '#a8a29e', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const item = payload[0].payload as CategorySalesItem;
                return (
                  <div className="bg-stone-900 border border-stone-700 p-2.5 rounded-xl shadow-xl text-xs space-y-1">
                    <p className="font-bold text-stone-200 capitalize">{item.category}</p>
                    <p className="text-amber-400 font-extrabold">{item.count} articles vendus</p>
                    <p className="text-stone-400 text-[11px]">{formatMoney(item.revenue)} générés</p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Bar dataKey="count" fill="#f59e0b" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// 3. REUSABLE PAYMENT DONUT PIE CHART
export interface PaymentPieItem {
  name: string;
  value: number;
  color: string;
  [key: string]: any;
}

export interface PaymentDistributionChartProps {
  data: PaymentPieItem[];
  height?: number;
  innerRadius?: number;
  outerRadius?: number;
  formatMoney?: (val: number) => string;
  valueFormatter?: (val: number) => string;
}

export const PaymentDistributionChart: React.FC<PaymentDistributionChartProps> = ({
  data,
  height = 200,
  innerRadius = 45,
  outerRadius = 68,
  formatMoney = (v) => `${v} FCFA`,
  valueFormatter,
}) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const formatter = valueFormatter || formatMoney;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4" style={{ height }}>
      <div className="w-48 h-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              innerRadius={innerRadius}
              outerRadius={outerRadius}
              paddingAngle={4}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} stroke="#1c1917" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const entry = payload[0].payload as PaymentPieItem;
                  const pct = total > 0 ? Math.round((entry.value / total) * 100) : 0;
                  return (
                    <div className="bg-stone-900 border border-stone-700 p-2 rounded-xl text-xs shadow-xl">
                      <p className="font-bold text-stone-200">{entry.name}</p>
                      <p className="text-amber-400 font-extrabold">{formatter(entry.value)} ({pct}%)</p>
                    </div>
                  );
                }
                return null;
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex-1 space-y-1.5 text-xs">
        {data.map((entry, idx) => {
          const pct = total > 0 ? Math.round((entry.value / total) * 100) : 0;
          return (
            <div key={idx} className="flex items-center justify-between text-stone-300">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="text-[11px] font-medium">{entry.name}</span>
              </div>
              <span className="text-[11px] font-bold text-stone-400">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const AreaTrendChart = DailySalesAreaChart;
export const DonutDistributionChart = PaymentDistributionChart;

export interface BarComparisonChartProps {
  data: any[];
  xKey: string;
  yKey: string;
  height?: number;
  barColor?: string;
  yFormatter?: (val: number) => string;
}

export const BarComparisonChart: React.FC<BarComparisonChartProps> = ({
  data,
  xKey,
  yKey,
  height = 240,
  barColor = '#f59e0b',
  yFormatter = (val) => `${val}`,
}) => {
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#292524" vertical={false} />
          <XAxis
            dataKey={xKey}
            stroke="#a8a29e"
            tick={{ fill: '#a8a29e', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: '#44403c' }}
          />
          <YAxis
            stroke="#a8a29e"
            tick={{ fill: '#a8a29e', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={yFormatter}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const item = payload[0].payload;
                return (
                  <div className="bg-stone-900 border border-stone-700/80 p-2.5 rounded-xl shadow-xl text-xs space-y-0.5">
                    <p className="font-bold text-stone-200">{item[xKey]}</p>
                    <p className="text-amber-400 font-black">{yFormatter(item[yKey])}</p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Bar dataKey={yKey} fill={barColor} radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export interface ChartMetric {
  label: string;
  value: string | number;
  highlight?: boolean;
  color?: string;
}

export interface ChartCardProps {
  title: string;
  subtitle?: string;
  description?: string;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  metrics?: ChartMetric[];
  children: React.ReactNode;
  className?: string;
}

export const ChartCard: React.FC<ChartCardProps> = ({
  title,
  subtitle,
  description,
  badge,
  action,
  metrics,
  children,
  className = '',
}) => {
  const displaySubtitle = subtitle || description;

  return (
    <div className={`bg-stone-900 border border-stone-800 rounded-3xl p-5 md:p-6 shadow-xl ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-800/80 pb-4 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-black text-base text-stone-100 tracking-tight">{title}</h3>
            {badge}
          </div>
          {displaySubtitle && <p className="text-xs text-stone-400 mt-0.5">{displaySubtitle}</p>}
        </div>
        {action && <div>{action}</div>}
      </div>

      {metrics && metrics.length > 0 && (
        <div className="flex flex-wrap items-center gap-4 mb-4 pb-3 border-b border-stone-850">
          {metrics.map((m, idx) => (
            <div key={idx} className="space-y-0.5">
              <span className="text-[11px] text-stone-400">{m.label}</span>
              <p
                className={`font-black text-sm ${
                  m.color || (m.highlight ? 'text-amber-400' : 'text-stone-200')
                }`}
              >
                {m.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {children}
    </div>
  );
};

