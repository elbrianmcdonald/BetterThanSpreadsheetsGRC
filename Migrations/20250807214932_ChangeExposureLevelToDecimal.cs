using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace CyberRiskApp.Migrations
{
    /// <inheritdoc />
    public partial class ChangeExposureLevelToDecimal : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RiskAssessmentControls");

            migrationBuilder.DropColumn(
                name: "ALEReductionAmount",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "ALEReductionPercentage",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "ALE_10th",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "ALE_50th",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "ALE_90th",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "ALE_95th",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "ActionSuccess",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "AnnualLossExpectancy",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "CalculatedVulnerability",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "CompetitiveAdvantageLossMax",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "CompetitiveAdvantageLossMin",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "CompetitiveAdvantageLossMostLikely",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "ContactFrequency",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "ControlledALE_10th",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "ControlledALE_50th",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "ControlledALE_90th",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "ControlledALE_95th",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "ControlledActionSuccess",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "ControlledAnnualLossExpectancy",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "ControlledContactFrequency",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "ControlledPrimaryLossMax",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "ControlledPrimaryLossMin",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "ControlledPrimaryLossMost",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "ControlledSecondaryLossMax",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "ControlledSecondaryLossMin",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "ControlledSecondaryLossMost",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "ControlledThreatEventFrequencyMax",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "ControlledThreatEventFrequencyMin",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "ControlledThreatEventFrequencyMost",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "DeductCybersecurityInsurance",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "DistributionType",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "ExternalStakeholderLossMax",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "ExternalStakeholderLossMin",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "ExternalStakeholderLossMostLikely",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "FinesMax",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "FinesMin",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "FinesMostLikely",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "IncludeSecondaryLoss",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "LossEventFrequency",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "LossMagnitudeConfidence",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "PrimaryLossMagnitude",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "PrimaryLossMax",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "PrimaryLossMin",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "PrimaryLossMost",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "PrimaryLoss_10th",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "PrimaryLoss_50th",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "PrimaryLoss_90th",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "PrimaryLoss_95th",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "ProductivityLossMax",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "ProductivityLossMin",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "ProductivityLossMostLikely",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "ReplacementCostMax",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "ReplacementCostMin",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "ReplacementCostMostLikely",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "ReputationDamageMax",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "ReputationDamageMin",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "ReputationDamageMostLikely",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "ResponseCostsMax",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "ResponseCostsMin",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "ResponseCostsMostLikely",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "SecondaryLossEventFrequency",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "SecondaryLossMagnitude",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "SecondaryLossMax",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "SecondaryLossMin",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "SecondaryLossMost",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "SecondaryProductivityLossMax",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "SecondaryProductivityLossMin",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "SecondaryProductivityLossMostLikely",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "SecondaryResponseCostMax",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "SecondaryResponseCostMin",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "SecondaryResponseCostMostLikely",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "SelectedDetectiveControls",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "SelectedProtectiveControls",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "SelectedResponseControls",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "SimulationIterations",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "ThreatAction",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "ThreatCommunity",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "ThreatEventFrequency",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "ThreatEventFrequencyConfidence",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "ThreatEventFrequencyMax",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "ThreatEventFrequencyMin",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "UsePerDistribution",
                table: "RiskAssessments");

            migrationBuilder.AlterColumn<decimal>(
                name: "QualitativeExposure",
                table: "ThreatScenarios",
                type: "numeric(3,2)",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);

            migrationBuilder.AlterColumn<decimal>(
                name: "QualitativeExposure",
                table: "RiskAssessments",
                type: "numeric(3,2)",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<int>(
                name: "QualitativeExposure",
                table: "ThreatScenarios",
                type: "integer",
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "numeric(3,2)",
                oldNullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "QualitativeExposure",
                table: "RiskAssessments",
                type: "integer",
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "numeric(3,2)",
                oldNullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ALEReductionAmount",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ALEReductionPercentage",
                table: "RiskAssessments",
                type: "numeric(5,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ALE_10th",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ALE_50th",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ALE_90th",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ALE_95th",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ActionSuccess",
                table: "RiskAssessments",
                type: "numeric(5,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "AnnualLossExpectancy",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "CalculatedVulnerability",
                table: "RiskAssessments",
                type: "numeric(5,4)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "CompetitiveAdvantageLossMax",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "CompetitiveAdvantageLossMin",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "CompetitiveAdvantageLossMostLikely",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "ContactFrequency",
                table: "RiskAssessments",
                type: "numeric(5,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "ControlledALE_10th",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ControlledALE_50th",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ControlledALE_90th",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ControlledALE_95th",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ControlledActionSuccess",
                table: "RiskAssessments",
                type: "numeric(5,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ControlledAnnualLossExpectancy",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ControlledContactFrequency",
                table: "RiskAssessments",
                type: "numeric(5,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ControlledPrimaryLossMax",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ControlledPrimaryLossMin",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ControlledPrimaryLossMost",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ControlledSecondaryLossMax",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ControlledSecondaryLossMin",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ControlledSecondaryLossMost",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ControlledThreatEventFrequencyMax",
                table: "RiskAssessments",
                type: "numeric(18,6)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ControlledThreatEventFrequencyMin",
                table: "RiskAssessments",
                type: "numeric(18,6)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ControlledThreatEventFrequencyMost",
                table: "RiskAssessments",
                type: "numeric(18,6)",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "DeductCybersecurityInsurance",
                table: "RiskAssessments",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "DistributionType",
                table: "RiskAssessments",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<decimal>(
                name: "ExternalStakeholderLossMax",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "ExternalStakeholderLossMin",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "ExternalStakeholderLossMostLikely",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "FinesMax",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "FinesMin",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "FinesMostLikely",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<bool>(
                name: "IncludeSecondaryLoss",
                table: "RiskAssessments",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<decimal>(
                name: "LossEventFrequency",
                table: "RiskAssessments",
                type: "numeric(18,6)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "LossMagnitudeConfidence",
                table: "RiskAssessments",
                type: "numeric(5,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "PrimaryLossMagnitude",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "PrimaryLossMax",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "PrimaryLossMin",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "PrimaryLossMost",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "PrimaryLoss_10th",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "PrimaryLoss_50th",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "PrimaryLoss_90th",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "PrimaryLoss_95th",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ProductivityLossMax",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "ProductivityLossMin",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "ProductivityLossMostLikely",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "ReplacementCostMax",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "ReplacementCostMin",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "ReplacementCostMostLikely",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "ReputationDamageMax",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "ReputationDamageMin",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "ReputationDamageMostLikely",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "ResponseCostsMax",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "ResponseCostsMin",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "ResponseCostsMostLikely",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "SecondaryLossEventFrequency",
                table: "RiskAssessments",
                type: "numeric(18,6)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "SecondaryLossMagnitude",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "SecondaryLossMax",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "SecondaryLossMin",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "SecondaryLossMost",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "SecondaryProductivityLossMax",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "SecondaryProductivityLossMin",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "SecondaryProductivityLossMostLikely",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "SecondaryResponseCostMax",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "SecondaryResponseCostMin",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "SecondaryResponseCostMostLikely",
                table: "RiskAssessments",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "SelectedDetectiveControls",
                table: "RiskAssessments",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "SelectedProtectiveControls",
                table: "RiskAssessments",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "SelectedResponseControls",
                table: "RiskAssessments",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "SimulationIterations",
                table: "RiskAssessments",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "ThreatAction",
                table: "RiskAssessments",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ThreatCommunity",
                table: "RiskAssessments",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<decimal>(
                name: "ThreatEventFrequency",
                table: "RiskAssessments",
                type: "numeric(18,6)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "ThreatEventFrequencyConfidence",
                table: "RiskAssessments",
                type: "numeric(5,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "ThreatEventFrequencyMax",
                table: "RiskAssessments",
                type: "numeric(18,6)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "ThreatEventFrequencyMin",
                table: "RiskAssessments",
                type: "numeric(18,6)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<bool>(
                name: "UsePerDistribution",
                table: "RiskAssessments",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "RiskAssessmentControls",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    RiskAssessmentId = table.Column<int>(type: "integer", nullable: false),
                    ControlDescription = table.Column<string>(type: "text", nullable: true),
                    ControlEffectiveness = table.Column<decimal>(type: "numeric(5,2)", nullable: false),
                    ControlName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    ControlType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ImplementationStatus = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RiskAssessmentControls", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RiskAssessmentControls_RiskAssessments_RiskAssessmentId",
                        column: x => x.RiskAssessmentId,
                        principalTable: "RiskAssessments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_RiskAssessmentControls_RiskAssessmentId",
                table: "RiskAssessmentControls",
                column: "RiskAssessmentId");
        }
    }
}
