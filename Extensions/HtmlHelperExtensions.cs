using Microsoft.AspNetCore.Html;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.AspNetCore.Mvc.ViewFeatures;
using System.Linq.Expressions;
using CyberRiskApp.Models;

namespace CyberRiskApp.Extensions
{
    public static class HtmlHelperExtensions
    {
        /// <summary>
        /// Renders a smart combobox for the specified property using reference data
        /// </summary>
        /// <typeparam name="TModel">The model type</typeparam>
        /// <typeparam name="TProperty">The property type</typeparam>
        /// <param name="htmlHelper">The HTML helper</param>
        /// <param name="expression">The property expression</param>
        /// <param name="category">The reference data category</param>
        /// <param name="canAddNew">Whether users can add new entries (default: false)</param>
        /// <param name="placeholder">The placeholder text</param>
        /// <param name="required">Whether the field is required</param>
        /// <param name="htmlAttributes">Additional HTML attributes</param>
        /// <returns>The HTML for the smart combobox</returns>
        public static IHtmlContent SmartComboboxFor<TModel, TProperty>(
            this IHtmlHelper<TModel> htmlHelper,
            Expression<Func<TModel, TProperty>> expression,
            ReferenceDataCategory category,
            bool canAddNew = false,
            string placeholder = "Type to search...",
            bool required = false,
            object? htmlAttributes = null)
        {
            var name = htmlHelper.NameFor(expression);
            var id = htmlHelper.IdFor(expression);
            var modelExplorer = htmlHelper.ViewContext.ViewData.ModelExplorer;
            var metadata = htmlHelper.ViewData.ModelMetadata;
            var value = htmlHelper.ValueFor(expression)?.ToString() ?? "";
            
            var select = new TagBuilder("select");
            select.Attributes["name"] = name;
            select.Attributes["id"] = id;
            select.AddCssClass("form-select smart-combobox");
            select.Attributes["data-category"] = ((int)category).ToString();
            select.Attributes["data-can-add-new"] = canAddNew.ToString().ToLower();
            select.Attributes["data-placeholder"] = placeholder;
            select.Attributes["style"] = "width: 100%;";
            
            if (required)
            {
                select.Attributes["required"] = "required";
            }
            
            if (htmlAttributes != null)
            {
                var attrs = HtmlHelper.AnonymousObjectToHtmlAttributes(htmlAttributes);
                foreach (var attr in attrs)
                {
                    select.Attributes[attr.Key] = attr.Value?.ToString();
                }
            }
            
            // Add current value as option if exists
            if (!string.IsNullOrEmpty(value))
            {
                var option = new TagBuilder("option");
                option.Attributes["value"] = value;
                option.Attributes["selected"] = "selected";
                option.InnerHtml.Append(value);
                select.InnerHtml.AppendHtml(option);
            }
            
            var validation = htmlHelper.ValidationMessageFor(expression, "", new { @class = "text-danger" });
            
            using (var writer = new System.IO.StringWriter())
            {
                select.WriteTo(writer, System.Text.Encodings.Web.HtmlEncoder.Default);
                validation.WriteTo(writer, System.Text.Encodings.Web.HtmlEncoder.Default);
                return new HtmlString(writer.ToString());
            }
        }

        /// <summary>
        /// Renders a smart combobox for asset selection
        /// </summary>
        public static IHtmlContent AssetComboboxFor<TModel, TProperty>(
            this IHtmlHelper<TModel> htmlHelper,
            Expression<Func<TModel, TProperty>> expression,
            bool canAddNew = false,
            bool required = false,
            object? htmlAttributes = null)
        {
            return htmlHelper.SmartComboboxFor(
                expression,
                ReferenceDataCategory.Asset,
                canAddNew,
                "Type to search for assets...",
                required,
                htmlAttributes);
        }

        /// <summary>
        /// Renders a smart combobox for business owner selection
        /// </summary>
        public static IHtmlContent BusinessOwnerComboboxFor<TModel, TProperty>(
            this IHtmlHelper<TModel> htmlHelper,
            Expression<Func<TModel, TProperty>> expression,
            bool canAddNew = false,
            bool required = false,
            object? htmlAttributes = null)
        {
            return htmlHelper.SmartComboboxFor(
                expression,
                ReferenceDataCategory.BusinessOwner,
                canAddNew,
                "Type to search for business owners...",
                required,
                htmlAttributes);
        }

        /// <summary>
        /// Renders a smart combobox for business unit selection
        /// </summary>
        public static IHtmlContent BusinessUnitComboboxFor<TModel, TProperty>(
            this IHtmlHelper<TModel> htmlHelper,
            Expression<Func<TModel, TProperty>> expression,
            bool canAddNew = false,
            bool required = false,
            object? htmlAttributes = null)
        {
            return htmlHelper.SmartComboboxFor(
                expression,
                ReferenceDataCategory.BusinessUnit,
                canAddNew,
                "Type to search for business units...",
                required,
                htmlAttributes);
        }

        /// <summary>
        /// Renders a smart combobox for technical control selection
        /// </summary>
        public static IHtmlContent TechnicalControlComboboxFor<TModel, TProperty>(
            this IHtmlHelper<TModel> htmlHelper,
            Expression<Func<TModel, TProperty>> expression,
            bool canAddNew = false,
            bool required = false,
            object? htmlAttributes = null)
        {
            return htmlHelper.SmartComboboxFor(
                expression,
                ReferenceDataCategory.TechnicalControl,
                canAddNew,
                "Type to search for technical controls...",
                required,
                htmlAttributes);
        }

        /// <summary>
        /// Renders a smart combobox for security control name selection
        /// </summary>
        public static IHtmlContent SecurityControlNameComboboxFor<TModel, TProperty>(
            this IHtmlHelper<TModel> htmlHelper,
            Expression<Func<TModel, TProperty>> expression,
            bool canAddNew = false,
            bool required = false,
            object? htmlAttributes = null)
        {
            return htmlHelper.SmartComboboxFor(
                expression,
                ReferenceDataCategory.SecurityControlName,
                canAddNew,
                "Type to search for security controls...",
                required,
                htmlAttributes);
        }
    }
}