import React, { useEffect, useMemo, useCallback, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import styled from 'styled-components';
import { Chart, registerables } from 'chart.js';
import { FaChartLine, FaArrowUp, FaArrowDown } from 'react-icons/fa';
import { Container } from '../../../../shared/components/layout/Container';
import { selectCurrentFolio } from '../../../../shared/store/billing.slice';
import { PRIMARY_COLORS, NEUTRAL_COLORS, SEMANTIC_COLORS } from '../../../../shared/styles/colors';

// Register Chart.js components
Chart.register(...registerables);

// Styled components for the widget
const StyledWidget = styled(Container)`
  background: ${NEUTRAL_COLORS.white};
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  height: ${props => props.height || 'auto'};
`;

const StyledHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
`;

const StyledTitle = styled.h3`
  color: ${PRIMARY_COLORS.main};
  font-size: 18px;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const StyledMetrics = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
`;

const StyledMetricCard = styled.div`
  background: ${NEUTRAL_COLORS.gray100};
  padding: 16px;
  border-radius: 6px;
`;

const StyledAmount = styled.div`
  font-size: 24px;
  font-weight: 600;
  color: ${PRIMARY_COLORS.main};
`;

const StyledTrend = styled.div<{ isPositive: boolean }>`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  color: ${props => props.isPositive ? SEMANTIC_COLORS.success : SEMANTIC_COLORS.error};
`;

const StyledChartContainer = styled.div`
  height: 200px;
  margin-top: 16px;
`;

// Interface definitions
interface IRevenueWidgetProps {
  period?: 'daily' | 'weekly' | 'monthly';
  showChart?: boolean;
  height?: string;
  refreshInterval?: number;
}

interface IRevenueData {
  currentRevenue: number;
  previousRevenue: number;
  percentageChange: number;
  trend: number[];
  targetAchievement: number;
}

// Helper function to format currency
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

/**
 * Revenue Widget Component
 * Displays real-time revenue metrics and trends for the hotel management dashboard
 */
const RevenueWidget: React.FC<IRevenueWidgetProps> = ({
  period = 'daily',
  showChart = true,
  height,
  refreshInterval = 300000 // 5 minutes default refresh
}) => {
  const dispatch = useDispatch();
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);
  const currentFolio = useSelector(selectCurrentFolio);

  // Calculate revenue metrics from folio data
  const calculateRevenueMetrics = useCallback((): IRevenueData => {
    const currentRevenue = currentFolio?.payments?.reduce((sum, payment) => 
      sum + (payment.status === 'CAPTURED' ? payment.amount : 0), 0) || 0;
    
    const previousRevenue = currentFolio?.payments?.reduce((sum, payment) => 
      sum + (payment.status === 'CAPTURED' && 
      new Date(payment.createdAt) < new Date(Date.now() - 86400000) ? payment.amount : 0), 0) || 0;
    
    const percentageChange = previousRevenue ? 
      ((currentRevenue - previousRevenue) / previousRevenue) * 100 : 0;
    
    // Generate trend data (last 7 data points)
    const trend = currentFolio?.payments?.reduce((acc: number[], payment) => {
      if (payment.status === 'CAPTURED') {
        acc.push(payment.amount);
      }
      return acc.slice(-7);
    }, []) || [];

    // Calculate achievement towards 15% revenue increase target
    const targetAchievement = (percentageChange / 15) * 100;

    return {
      currentRevenue,
      previousRevenue,
      percentageChange,
      trend,
      targetAchievement
    };
  }, [currentFolio]);

  // Memoized revenue data
  const revenueData = useMemo(() => calculateRevenueMetrics(), [calculateRevenueMetrics]);

  // Initialize and update chart
  const updateChart = useCallback(() => {
    if (!chartRef.current || !showChart) return;

    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;

    chartInstance.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: Array(revenueData.trend.length).fill('').map((_, i) => `Day ${i + 1}`),
        datasets: [{
          label: 'Revenue Trend',
          data: revenueData.trend,
          borderColor: PRIMARY_COLORS.main,
          tension: 0.4,
          fill: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value) => formatCurrency(value as number)
            }
          }
        }
      }
    });
  }, [revenueData.trend, showChart]);

  // Setup refresh interval
  useEffect(() => {
    const intervalId = setInterval(() => {
      // Refresh data logic here
    }, refreshInterval);

    return () => clearInterval(intervalId);
  }, [refreshInterval]);

  // Update chart when data changes
  useEffect(() => {
    updateChart();
    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [updateChart]);

  return (
    <StyledWidget height={height}>
      <StyledHeader>
        <StyledTitle>
          <FaChartLine /> Revenue Overview
        </StyledTitle>
      </StyledHeader>

      <StyledMetrics>
        <StyledMetricCard>
          <div>Current Revenue</div>
          <StyledAmount>{formatCurrency(revenueData.currentRevenue)}</StyledAmount>
          <StyledTrend isPositive={revenueData.percentageChange >= 0}>
            {revenueData.percentageChange >= 0 ? <FaArrowUp /> : <FaArrowDown />}
            {Math.abs(revenueData.percentageChange).toFixed(1)}%
          </StyledTrend>
        </StyledMetricCard>

        <StyledMetricCard>
          <div>Target Progress</div>
          <StyledAmount>
            {revenueData.targetAchievement.toFixed(1)}%
          </StyledAmount>
          <StyledTrend isPositive={revenueData.targetAchievement >= 100}>
            {revenueData.targetAchievement >= 100 ? 'On Target' : 'In Progress'}
          </StyledTrend>
        </StyledMetricCard>
      </StyledMetrics>

      {showChart && (
        <StyledChartContainer>
          <canvas ref={chartRef} />
        </StyledChartContainer>
      )}
    </StyledWidget>
  );
};

export default RevenueWidget;