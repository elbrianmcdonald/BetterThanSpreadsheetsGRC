using System;
using System.Collections.Generic;
using System.Linq;

namespace CyberRiskApp.Services
{
    public interface IMonteCarloSimulationService
    {
        MonteCarloResult RunSimulation(MonteCarloInput input);
    }

    public class MonteCarloSimulationService : IMonteCarloSimulationService
    {
        private readonly Random _random = new Random();

        public MonteCarloResult RunSimulation(MonteCarloInput input)
        {
            var iterations = input.Iterations;
            var aleResults = new List<decimal>();
            var primaryLossResults = new List<decimal>();
            var secondaryLossResults = new List<decimal>();

            for (int i = 0; i < iterations; i++)
            {
                // Sample from distributions
                var tef = SampleFromDistribution(input.TefMin, input.TefMostLikely, input.TefMax, 
                    input.TefConfidence, input.DistributionType);
                
                // Calculate vulnerability based on Defense in Depth
                var vulnerability = input.CalculatedVulnerability ?? 0.5m;
                
                // Calculate Loss Event Frequency
                var lef = tef * vulnerability;
                
                // Sample Primary Loss components
                var productivityLoss = SampleFromDistribution(input.ProductivityLossMin, 
                    input.ProductivityLossMostLikely, input.ProductivityLossMax, 
                    input.LossConfidence, input.DistributionType);
                
                var responseCosts = SampleFromDistribution(input.ResponseCostsMin, 
                    input.ResponseCostsMostLikely, input.ResponseCostsMax, 
                    input.LossConfidence, input.DistributionType);
                
                var replacementCost = SampleFromDistribution(input.ReplacementCostMin, 
                    input.ReplacementCostMostLikely, input.ReplacementCostMax, 
                    input.LossConfidence, input.DistributionType);
                
                var fines = SampleFromDistribution(input.FinesMin, 
                    input.FinesMostLikely, input.FinesMax, 
                    input.LossConfidence, input.DistributionType);
                
                // Calculate Primary Loss Magnitude
                var primaryLoss = productivityLoss + responseCosts;
                if (replacementCost > 1000) primaryLoss += replacementCost;
                if (fines > 1000) primaryLoss += fines;
                
                // Sample Secondary Loss components if provided
                decimal secondaryLoss = 0;
                if (input.IncludeSecondaryLoss)
                {
                    var secondaryResponseCost = SampleFromDistribution(input.SecondaryResponseCostMin,
                        input.SecondaryResponseCostMostLikely, input.SecondaryResponseCostMax,
                        input.LossConfidence, input.DistributionType);
                    
                    var secondaryProductivityLoss = SampleFromDistribution(input.SecondaryProductivityLossMin,
                        input.SecondaryProductivityLossMostLikely, input.SecondaryProductivityLossMax,
                        input.LossConfidence, input.DistributionType);
                    
                    var reputationDamage = SampleFromDistribution(input.ReputationDamageMin,
                        input.ReputationDamageMostLikely, input.ReputationDamageMax,
                        input.LossConfidence, input.DistributionType);
                    
                    var competitiveAdvantageLoss = SampleFromDistribution(input.CompetitiveAdvantageLossMin,
                        input.CompetitiveAdvantageLossMostLikely, input.CompetitiveAdvantageLossMax,
                        input.LossConfidence, input.DistributionType);
                    
                    var externalStakeholderLoss = SampleFromDistribution(input.ExternalStakeholderLossMin,
                        input.ExternalStakeholderLossMostLikely, input.ExternalStakeholderLossMax,
                        input.LossConfidence, input.DistributionType);
                    
                    secondaryLoss = secondaryResponseCost + secondaryProductivityLoss + 
                                   reputationDamage + competitiveAdvantageLoss + externalStakeholderLoss;
                    
                    // Apply secondary loss event frequency if different
                    if (input.SecondaryLossEventFrequency.HasValue && input.SecondaryLossEventFrequency.Value > 0)
                    {
                        var slef = input.SecondaryLossEventFrequency.Value;
                        secondaryLoss = secondaryLoss * (slef / lef); // Adjust for different frequency
                    }
                }
                
                // Calculate Total Loss
                var totalLoss = primaryLoss + secondaryLoss;
                
                // Calculate ALE
                var ale = lef * totalLoss;
                
                // Apply insurance deduction if applicable
                if (input.DeductInsurance && input.InsuranceAmount > 0)
                {
                    ale = Math.Max(0, ale - input.InsuranceAmount);
                }
                
                aleResults.Add(ale);
                primaryLossResults.Add(primaryLoss);
                secondaryLossResults.Add(secondaryLoss);
            }

            // Sort results for percentile calculations
            aleResults.Sort();
            primaryLossResults.Sort();
            secondaryLossResults.Sort();

            return new MonteCarloResult
            {
                ALE_10th = GetPercentile(aleResults, 10),
                ALE_50th = GetPercentile(aleResults, 50),
                ALE_90th = GetPercentile(aleResults, 90),
                ALE_95th = GetPercentile(aleResults, 95),
                PrimaryLoss_10th = GetPercentile(primaryLossResults, 10),
                PrimaryLoss_50th = GetPercentile(primaryLossResults, 50),
                PrimaryLoss_90th = GetPercentile(primaryLossResults, 90),
                PrimaryLoss_95th = GetPercentile(primaryLossResults, 95),
                MeanALE = aleResults.Average(),
                StandardDeviation = CalculateStandardDeviation(aleResults),
                MinALE = aleResults.Min(),
                MaxALE = aleResults.Max()
            };
        }

        private decimal SampleFromDistribution(decimal min, decimal mostLikely, decimal max, 
            decimal confidence, string distributionType)
        {
            switch (distributionType.ToUpper())
            {
                case "PERT":
                    return SamplePERT(min, mostLikely, max, confidence);
                case "NORMAL":
                    return SampleNormal(mostLikely, (max - min) / 4); // Approximate std dev
                case "LOGNORMAL":
                    return SampleLogNormal(mostLikely, (max - min) / 4);
                case "UNIFORM":
                    return SampleUniform(min, max);
                default:
                    return SamplePERT(min, mostLikely, max, confidence);
            }
        }

        private decimal SamplePERT(decimal min, decimal mostLikely, decimal max, decimal confidence)
        {
            // PERT distribution with shape parameter based on confidence
            // Higher confidence = more weight on most likely value
            double lambda = confidence >= 95 ? 4.0 : 2.0;
            
            double alpha = 1 + lambda * ((double)(mostLikely - min) / (double)(max - min));
            double beta = 1 + lambda * ((double)(max - mostLikely) / (double)(max - min));
            
            // Use Beta distribution
            double sample = SampleBeta(alpha, beta);
            
            return min + (decimal)sample * (max - min);
        }

        private double SampleBeta(double alpha, double beta)
        {
            // Simple rejection sampling for Beta distribution
            double x, y;
            do
            {
                x = _random.NextDouble();
                y = _random.NextDouble();
            } while (y > Math.Pow(x, alpha - 1) * Math.Pow(1 - x, beta - 1));
            
            return x;
        }

        private decimal SampleNormal(decimal mean, decimal stdDev)
        {
            // Box-Muller transform for normal distribution
            double u1 = 1.0 - _random.NextDouble(); // Uniform(0,1] random doubles
            double u2 = 1.0 - _random.NextDouble();
            double randStdNormal = Math.Sqrt(-2.0 * Math.Log(u1)) * 
                                  Math.Sin(2.0 * Math.PI * u2);
            
            return mean + (decimal)randStdNormal * stdDev;
        }

        private decimal SampleLogNormal(decimal median, decimal geometricStdDev)
        {
            // Convert to log-space parameters
            double logMedian = Math.Log((double)median);
            double logStdDev = Math.Log((double)geometricStdDev);
            
            // Sample from normal in log space
            decimal normalSample = SampleNormal((decimal)logMedian, (decimal)logStdDev);
            
            // Transform back
            return (decimal)Math.Exp((double)normalSample);
        }

        private decimal SampleUniform(decimal min, decimal max)
        {
            return min + (decimal)_random.NextDouble() * (max - min);
        }

        private decimal GetPercentile(List<decimal> sortedList, int percentile)
        {
            if (sortedList.Count == 0) return 0;
            
            int index = (int)Math.Ceiling(percentile / 100.0 * sortedList.Count) - 1;
            index = Math.Max(0, Math.Min(index, sortedList.Count - 1));
            
            return sortedList[index];
        }

        private decimal CalculateStandardDeviation(List<decimal> values)
        {
            if (values.Count <= 1) return 0;
            
            decimal mean = values.Average();
            decimal sumOfSquares = values.Sum(v => (v - mean) * (v - mean));
            
            return (decimal)Math.Sqrt((double)(sumOfSquares / (values.Count - 1)));
        }
    }

    public class MonteCarloInput
    {
        public int Iterations { get; set; } = 10000;
        public string DistributionType { get; set; } = "PERT";
        
        // TEF Distribution
        public decimal TefMin { get; set; }
        public decimal TefMostLikely { get; set; }
        public decimal TefMax { get; set; }
        public decimal TefConfidence { get; set; } = 90;
        
        // Vulnerability (from Defense in Depth calculation)
        public decimal? CalculatedVulnerability { get; set; }
        
        // Primary Loss Distributions
        public decimal ProductivityLossMin { get; set; }
        public decimal ProductivityLossMostLikely { get; set; }
        public decimal ProductivityLossMax { get; set; }
        
        public decimal ResponseCostsMin { get; set; }
        public decimal ResponseCostsMostLikely { get; set; }
        public decimal ResponseCostsMax { get; set; }
        
        public decimal ReplacementCostMin { get; set; }
        public decimal ReplacementCostMostLikely { get; set; }
        public decimal ReplacementCostMax { get; set; }
        
        public decimal FinesMin { get; set; }
        public decimal FinesMostLikely { get; set; }
        public decimal FinesMax { get; set; }
        
        // Secondary Loss Distributions
        public bool IncludeSecondaryLoss { get; set; }
        public decimal? SecondaryLossEventFrequency { get; set; }
        
        public decimal SecondaryResponseCostMin { get; set; }
        public decimal SecondaryResponseCostMostLikely { get; set; }
        public decimal SecondaryResponseCostMax { get; set; }
        
        public decimal SecondaryProductivityLossMin { get; set; }
        public decimal SecondaryProductivityLossMostLikely { get; set; }
        public decimal SecondaryProductivityLossMax { get; set; }
        
        public decimal ReputationDamageMin { get; set; }
        public decimal ReputationDamageMostLikely { get; set; }
        public decimal ReputationDamageMax { get; set; }
        
        public decimal CompetitiveAdvantageLossMin { get; set; }
        public decimal CompetitiveAdvantageLossMostLikely { get; set; }
        public decimal CompetitiveAdvantageLossMax { get; set; }
        
        public decimal ExternalStakeholderLossMin { get; set; }
        public decimal ExternalStakeholderLossMostLikely { get; set; }
        public decimal ExternalStakeholderLossMax { get; set; }
        
        public decimal LossConfidence { get; set; } = 90;
        
        // Insurance
        public bool DeductInsurance { get; set; }
        public decimal InsuranceAmount { get; set; }
    }

    public class MonteCarloResult
    {
        public decimal ALE_10th { get; set; }
        public decimal ALE_50th { get; set; }
        public decimal ALE_90th { get; set; }
        public decimal ALE_95th { get; set; }
        
        public decimal PrimaryLoss_10th { get; set; }
        public decimal PrimaryLoss_50th { get; set; }
        public decimal PrimaryLoss_90th { get; set; }
        public decimal PrimaryLoss_95th { get; set; }
        
        public decimal MeanALE { get; set; }
        public decimal StandardDeviation { get; set; }
        public decimal MinALE { get; set; }
        public decimal MaxALE { get; set; }
    }
}