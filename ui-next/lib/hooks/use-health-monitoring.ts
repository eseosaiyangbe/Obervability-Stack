import { useState, useEffect, useCallback } from 'react';
import { healthAPI, HealthCheckResult, ServiceHealth } from '../health-api';

export interface UseHealthMonitoringReturn {
  healthData: HealthCheckResult | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  checkSingleService: (serviceName: string) => Promise<ServiceHealth>;
  quickLinks: Array<{
    name: string;
    url: string;
    description: string;
    icon: string;
  }>;
}

export function useHealthMonitoring(): UseHealthMonitoringReturn {
  const [healthData, setHealthData] = useState<HealthCheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHealthData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/services/health', {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`Health API returned HTTP ${response.status}`);
      }

      const result = await response.json();
      setHealthData({
        ...result,
        lastUpdated: new Date(result.lastUpdated),
        services: result.services.map((service: ServiceHealth & { lastChecked: string }) => ({
          ...service,
          lastChecked: new Date(service.lastChecked),
        })),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch health data');
      console.error('Error fetching health data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const checkSingleService = useCallback(async (serviceName: string): Promise<ServiceHealth> => {
    try {
      const response = await fetch('/api/services/health', {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`Health API returned HTTP ${response.status}`);
      }

      const result = await response.json();
      const serviceHealth = result.services.find((service: ServiceHealth) => service.name === serviceName);

      if (!serviceHealth) {
        throw new Error(`Service ${serviceName} not found`);
      }

      serviceHealth.lastChecked = new Date(serviceHealth.lastChecked);
      
      // Update the health data with the new service status
      if (healthData) {
        const updatedServices = healthData.services.map(service => 
          service.name === serviceName ? serviceHealth : service
        );
        
        // Recalculate overall status
        const upServices = updatedServices.filter(s => s.status === 'up').length;
        const totalServices = updatedServices.length;
        
        let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
        if (upServices === totalServices) {
          overallStatus = 'healthy';
        } else if (upServices >= totalServices * 0.5) {
          overallStatus = 'degraded';
        } else {
          overallStatus = 'unhealthy';
        }

        setHealthData({
          services: updatedServices,
          overallStatus,
          lastUpdated: new Date()
        });
      }
      
      return serviceHealth;
    } catch (err) {
      console.error(`Error checking service ${serviceName}:`, err);
      throw err;
    }
  }, [healthData]);

  const refresh = useCallback(() => {
    fetchHealthData();
  }, [fetchHealthData]);

  // Get quick links
  const quickLinks = healthAPI.getQuickLinks();

  // Fetch health data on mount
  useEffect(() => {
    fetchHealthData();
  }, [fetchHealthData]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchHealthData();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchHealthData]);

  return {
    healthData,
    loading,
    error,
    refresh,
    checkSingleService,
    quickLinks,
  };
}
