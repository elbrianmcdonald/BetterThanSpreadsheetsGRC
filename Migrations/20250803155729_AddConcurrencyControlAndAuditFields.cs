using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CyberRiskApp.Migrations
{
    /// <inheritdoc />
    public partial class AddConcurrencyControlAndAuditFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CreatedBy",
                table: "Risks",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<byte[]>(
                name: "RowVersion",
                table: "Risks",
                type: "bytea",
                rowVersion: true,
                nullable: false,
                defaultValue: new byte[0]);

            migrationBuilder.AddColumn<string>(
                name: "UpdatedBy",
                table: "Risks",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "CreatedBy",
                table: "RiskAssessments",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<byte[]>(
                name: "RowVersion",
                table: "RiskAssessments",
                type: "bytea",
                rowVersion: true,
                nullable: false,
                defaultValue: new byte[0]);

            migrationBuilder.AddColumn<string>(
                name: "UpdatedBy",
                table: "RiskAssessments",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "CreatedBy",
                table: "MaturityControlAssessments",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<byte[]>(
                name: "RowVersion",
                table: "MaturityControlAssessments",
                type: "bytea",
                rowVersion: true,
                nullable: false,
                defaultValue: new byte[0]);

            migrationBuilder.AddColumn<string>(
                name: "UpdatedBy",
                table: "MaturityControlAssessments",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "CreatedBy",
                table: "MaturityAssessments",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<byte[]>(
                name: "RowVersion",
                table: "MaturityAssessments",
                type: "bytea",
                rowVersion: true,
                nullable: false,
                defaultValue: new byte[0]);

            migrationBuilder.AddColumn<string>(
                name: "UpdatedBy",
                table: "MaturityAssessments",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "CreatedBy",
                table: "Findings",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<byte[]>(
                name: "RowVersion",
                table: "Findings",
                type: "bytea",
                rowVersion: true,
                nullable: false,
                defaultValue: new byte[0]);

            migrationBuilder.AddColumn<string>(
                name: "UpdatedBy",
                table: "Findings",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "CreatedBy",
                table: "ControlAssessments",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<byte[]>(
                name: "RowVersion",
                table: "ControlAssessments",
                type: "bytea",
                rowVersion: true,
                nullable: false,
                defaultValue: new byte[0]);

            migrationBuilder.AddColumn<string>(
                name: "UpdatedBy",
                table: "ControlAssessments",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "CreatedBy",
                table: "ComplianceAssessments",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<byte[]>(
                name: "RowVersion",
                table: "ComplianceAssessments",
                type: "bytea",
                rowVersion: true,
                nullable: false,
                defaultValue: new byte[0]);

            migrationBuilder.AddColumn<string>(
                name: "UpdatedBy",
                table: "ComplianceAssessments",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CreatedBy",
                table: "Risks");

            migrationBuilder.DropColumn(
                name: "RowVersion",
                table: "Risks");

            migrationBuilder.DropColumn(
                name: "UpdatedBy",
                table: "Risks");

            migrationBuilder.DropColumn(
                name: "CreatedBy",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "RowVersion",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "UpdatedBy",
                table: "RiskAssessments");

            migrationBuilder.DropColumn(
                name: "CreatedBy",
                table: "MaturityControlAssessments");

            migrationBuilder.DropColumn(
                name: "RowVersion",
                table: "MaturityControlAssessments");

            migrationBuilder.DropColumn(
                name: "UpdatedBy",
                table: "MaturityControlAssessments");

            migrationBuilder.DropColumn(
                name: "CreatedBy",
                table: "MaturityAssessments");

            migrationBuilder.DropColumn(
                name: "RowVersion",
                table: "MaturityAssessments");

            migrationBuilder.DropColumn(
                name: "UpdatedBy",
                table: "MaturityAssessments");

            migrationBuilder.DropColumn(
                name: "CreatedBy",
                table: "Findings");

            migrationBuilder.DropColumn(
                name: "RowVersion",
                table: "Findings");

            migrationBuilder.DropColumn(
                name: "UpdatedBy",
                table: "Findings");

            migrationBuilder.DropColumn(
                name: "CreatedBy",
                table: "ControlAssessments");

            migrationBuilder.DropColumn(
                name: "RowVersion",
                table: "ControlAssessments");

            migrationBuilder.DropColumn(
                name: "UpdatedBy",
                table: "ControlAssessments");

            migrationBuilder.DropColumn(
                name: "CreatedBy",
                table: "ComplianceAssessments");

            migrationBuilder.DropColumn(
                name: "RowVersion",
                table: "ComplianceAssessments");

            migrationBuilder.DropColumn(
                name: "UpdatedBy",
                table: "ComplianceAssessments");
        }
    }
}
