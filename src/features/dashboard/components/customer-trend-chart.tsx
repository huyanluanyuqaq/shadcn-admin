import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type CustomerTrendChartProps = {
  data: { month: string; count: number }[]
}

export function CustomerTrendChart({ data }: CustomerTrendChartProps) {
  return (
    <ResponsiveContainer width='100%' height={300}>
      <LineChart
        data={data}
        margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
      >
        <CartesianGrid strokeDasharray='3 3' vertical={false} />
        <XAxis
          dataKey='month'
          stroke='#888888'
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          allowDecimals={false}
          stroke='#888888'
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{
            borderRadius: 8,
            fontSize: 12,
            border: '1px solid var(--border)',
          }}
        />
        <Line
          type='monotone'
          dataKey='count'
          name='客户数'
          stroke='currentColor'
          className='text-primary'
          strokeWidth={2}
          dot={{ r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
