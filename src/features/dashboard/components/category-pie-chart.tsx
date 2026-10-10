import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'

/** 饼图配色（Recharts 需要具体色值） */
const COLORS = [
  '#2563eb',
  '#16a34c',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#ec4899',
  '#84cc16',
]

type CategoryPieChartProps = {
  data: { name: string; count: number }[]
}

export function CategoryPieChart({ data }: CategoryPieChartProps) {
  return (
    <ResponsiveContainer width='100%' height={300}>
      <PieChart>
        <Pie
          data={data}
          dataKey='count'
          nameKey='name'
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
        >
          {data.map((entry, index) => (
            <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            borderRadius: 8,
            fontSize: 12,
            border: '1px solid var(--border)',
          }}
        />
        <Legend verticalAlign='bottom' height={24} />
      </PieChart>
    </ResponsiveContainer>
  )
}
