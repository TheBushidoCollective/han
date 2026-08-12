//! EntityFilter derive macro implementation.
//!
//! Generates `{Name}Filter` (InputObject) and `{Name}OrderBy` (InputObject)
//! from a source struct that mirrors filterable entity columns.
//!
//! Supports association filtering via `#[entity_filter(assoc(...))]` on marker
//! fields (typed `()`). Associations generate nested filter fields and
//! `IN (SELECT ...)` subquery conditions automatically.

use convert_case::{Case, Casing};
use proc_macro::TokenStream;
use proc_macro2::TokenStream as TokenStream2;
use quote::{format_ident, quote};
use syn::{parse_macro_input, Data, DeriveInput, Fields, Lit, Meta, Type};

/// Extract a string value from a `key = "value"` meta attribute.
fn meta_string(meta: &Meta, key: &str) -> Option<String> {
    if let Meta::NameValue(nv) = meta {
        if nv.path.is_ident(key) {
            if let syn::Expr::Lit(expr_lit) = &nv.value {
                if let Lit::Str(s) = &expr_lit.lit {
                    return Some(s.value());
                }
            }
        }
    }
    None
}

/// Determine the filter type for a given Rust type.
fn filter_type_for(ty: &Type) -> Option<TokenStream2> {
    let ty_str = type_to_string(ty);
    // Strip Option wrapper
    let inner = if ty_str.starts_with("Option < ") {
        ty_str
            .strip_prefix("Option < ")
            .and_then(|s| s.strip_suffix(" >"))
            .unwrap_or(&ty_str)
    } else {
        &ty_str
    };

    match inner {
        "String" | "& str" | "&str" => Some(quote! { crate::filters::types::StringFilter }),
        "i32" => Some(quote! { crate::filters::types::IntFilter }),
        "i64" => Some(quote! { crate::filters::types::Int64Filter }),
        "f32" | "f64" => Some(quote! { crate::filters::types::FloatFilter }),
        "bool" => Some(quote! { crate::filters::types::BoolFilter }),
        _ => None,
    }
}

/// Convert a Type to a rough string representation for matching.
fn type_to_string(ty: &Type) -> String {
    quote!(#ty).to_string()
}

/// Parse the #[entity_filter(...)] container attribute.
struct ContainerAttrs {
    entity_path: syn::Path,
    columns_path: syn::Path,
}

fn parse_container_attrs(input: &DeriveInput) -> ContainerAttrs {
    let mut entity_str = None;
    let mut columns_str = None;

    for attr in &input.attrs {
        if !attr.path().is_ident("entity_filter") {
            continue;
        }
        let nested = attr
            .parse_args_with(syn::punctuated::Punctuated::<Meta, syn::Token![,]>::parse_terminated)
            .expect("Failed to parse entity_filter attributes");

        for meta in &nested {
            if let Some(v) = meta_string(meta, "entity") {
                entity_str = Some(v);
            }
            if let Some(v) = meta_string(meta, "columns") {
                columns_str = Some(v);
            }
        }
    }

    let entity_str = entity_str.expect("entity_filter requires `entity` attribute");
    let columns_str = columns_str.expect("entity_filter requires `columns` attribute");

    ContainerAttrs {
        entity_path: syn::parse_str(&entity_str).expect("Invalid entity path"),
        columns_path: syn::parse_str(&columns_str).expect("Invalid columns path"),
    }
}

/// Parsed association declaration from `#[entity_filter(assoc(...))]`.
struct AssocDecl {
    /// GraphQL field name (from the Rust field name, camelCased).
    graphql_name: String,
    /// Rust field name for the association field.
    field_ident: syn::Ident,
    /// Path to the associated entity's filter type.
    filter_type: syn::Path,
    /// Local column variant on *this* entity (e.g. `ProjectId`).
    local_column: syn::Ident,
    /// SeaORM Entity path for the foreign entity.
    foreign_entity: syn::Path,
    /// Full column path for the foreign key (e.g. `projects::Column::Id`).
    foreign_column: syn::Path,
}

/// Try to parse association metadata from a field's attributes.
///
/// Looks for `#[entity_filter(assoc(filter = "...", local_column = "...",
/// foreign_entity = "...", foreign_column = "..."))]`.
fn parse_field_assoc(field: &syn::Field) -> Option<AssocDecl> {
    let field_name = field.ident.as_ref()?;

    for attr in &field.attrs {
        if !attr.path().is_ident("entity_filter") {
            continue;
        }
        if let Ok(nested) = attr
            .parse_args_with(syn::punctuated::Punctuated::<Meta, syn::Token![,]>::parse_terminated)
        {
            for meta in &nested {
                // Look for assoc(...) — a Meta::List with path "assoc"
                if let Meta::List(list) = meta {
                    if !list.path.is_ident("assoc") {
                        continue;
                    }
                    // Parse the inner key-value pairs
                    let inner: syn::punctuated::Punctuated<Meta, syn::Token![,]> = list
                        .parse_args_with(
                            syn::punctuated::Punctuated::<Meta, syn::Token![,]>::parse_terminated,
                        )
                        .expect("Failed to parse assoc(...) attributes");

                    let mut filter_str = None;
                    let mut local_col_str = None;
                    let mut foreign_ent_str = None;
                    let mut foreign_col_str = None;

                    for inner_meta in &inner {
                        if let Some(v) = meta_string(inner_meta, "filter") {
                            filter_str = Some(v);
                        }
                        if let Some(v) = meta_string(inner_meta, "local_column") {
                            local_col_str = Some(v);
                        }
                        if let Some(v) = meta_string(inner_meta, "foreign_entity") {
                            foreign_ent_str = Some(v);
                        }
                        if let Some(v) = meta_string(inner_meta, "foreign_column") {
                            foreign_col_str = Some(v);
                        }
                    }

                    let filter_str = filter_str.expect("assoc() requires `filter` attribute");
                    let local_col_str =
                        local_col_str.expect("assoc() requires `local_column` attribute");
                    let foreign_ent_str =
                        foreign_ent_str.expect("assoc() requires `foreign_entity` attribute");
                    let foreign_col_str =
                        foreign_col_str.expect("assoc() requires `foreign_column` attribute");

                    let graphql_name = field_name.to_string().to_case(Case::Camel);

                    return Some(AssocDecl {
                        graphql_name,
                        field_ident: field_name.clone(),
                        filter_type: syn::parse_str(&filter_str)
                            .expect("Invalid assoc filter path"),
                        local_column: format_ident!("{}", local_col_str),
                        foreign_entity: syn::parse_str(&foreign_ent_str)
                            .expect("Invalid assoc foreign_entity path"),
                        foreign_column: syn::parse_str(&foreign_col_str)
                            .expect("Invalid assoc foreign_column path"),
                    });
                }
            }
        }
    }
    None
}

/// Check if a field has #[entity_filter(skip)].
fn is_field_skipped(field: &syn::Field) -> bool {
    for attr in &field.attrs {
        if !attr.path().is_ident("entity_filter") {
            continue;
        }
        if let Ok(nested) = attr
            .parse_args_with(syn::punctuated::Punctuated::<Meta, syn::Token![,]>::parse_terminated)
        {
            for meta in &nested {
                if let Meta::Path(p) = meta {
                    if p.is_ident("skip") {
                        return true;
                    }
                }
            }
        }
    }
    false
}

pub fn derive(input: TokenStream) -> TokenStream {
    let input = parse_macro_input!(input as DeriveInput);
    let container = parse_container_attrs(&input);
    let struct_name = &input.ident;

    // Derive filter name from struct name, stripping "FilterSource" suffix if present
    let base_name = struct_name
        .to_string()
        .strip_suffix("FilterSource")
        .map(|s| s.to_string())
        .unwrap_or_else(|| struct_name.to_string());

    let filter_name = format_ident!("{}Filter", base_name);
    let order_by_name = format_ident!("{}OrderBy", base_name);
    let filter_name_str = format!("{}Filter", base_name);
    let order_by_name_str = format!("{}OrderBy", base_name);

    let columns_path = &container.columns_path;

    let fields = match &input.data {
        Data::Struct(data) => match &data.fields {
            Fields::Named(f) => &f.named,
            _ => panic!("EntityFilter only supports named fields"),
        },
        _ => panic!("EntityFilter only supports structs"),
    };

    let mut filter_fields = Vec::new();
    let mut filter_conditions = Vec::new();
    let mut order_fields = Vec::new();
    let mut order_applications = Vec::new();
    let mut assoc_filter_fields = Vec::new();
    let mut assoc_filter_conditions = Vec::new();

    for field in fields {
        // Check for association declaration first
        if let Some(assoc) = parse_field_assoc(field) {
            let gql_name = &assoc.graphql_name;
            let field_ident = &assoc.field_ident;
            let filter_ty = &assoc.filter_type;
            let local_col = &assoc.local_column;
            let foreign_ent = &assoc.foreign_entity;
            let foreign_col = &assoc.foreign_column;

            assoc_filter_fields.push(quote! {
                /// Association filter (auto-generated).
                #[graphql(name = #gql_name)]
                pub #field_ident: Option<#filter_ty>,
            });

            assoc_filter_conditions.push(quote! {
                if let Some(ref assoc_filter) = self.#field_ident {
                    use sea_orm::{EntityTrait, QueryFilter, QuerySelect, QueryTrait};
                    let sub_cond = assoc_filter.to_condition();
                    let sub_query = #foreign_ent::find()
                        .filter(sub_cond)
                        .select_only()
                        .column(#foreign_col)
                        .into_query();
                    cond = cond.add(#columns_path::#local_col.in_subquery(sub_query));
                }
            });

            continue;
        }

        if is_field_skipped(field) {
            continue;
        }

        let field_name = field.ident.as_ref().unwrap();
        let field_ty = &field.ty;

        let Some(filter_ty) = filter_type_for(field_ty) else {
            continue;
        };

        // GraphQL field name (camelCase)
        let graphql_name = field_name.to_string().to_case(Case::Camel);

        // SeaORM Column variant (PascalCase)
        let column_variant = format_ident!("{}", field_name.to_string().to_case(Case::Pascal));

        // Filter field
        filter_fields.push(quote! {
            #[graphql(name = #graphql_name)]
            pub #field_name: Option<#filter_ty>,
        });

        // Condition application
        filter_conditions.push(quote! {
            if let Some(ref f) = self.#field_name {
                cond = cond.add(crate::filters::apply::ApplyFilter::apply(f, #columns_path::#column_variant));
            }
        });

        // OrderBy field
        order_fields.push(quote! {
            #[graphql(name = #graphql_name)]
            pub #field_name: Option<crate::filters::ordering::OrderDirection>,
        });

        // Order application
        order_applications.push(quote! {
            if let Some(dir) = self.#field_name {
                query = query.order_by(#columns_path::#column_variant, dir.into());
            }
        });
    }

    let entity_path = &container.entity_path;

    let expanded = quote! {
        /// Auto-generated filter input type.
        #[derive(async_graphql::InputObject, Default, Clone, Debug)]
        #[graphql(name = #filter_name_str)]
        pub struct #filter_name {
            #(#filter_fields)*
            #(#assoc_filter_fields)*
            /// Logical AND: all conditions must match.
            #[graphql(name = "_and")]
            pub and: Option<Vec<#filter_name>>,
            /// Logical OR: at least one condition must match.
            #[graphql(name = "_or")]
            pub or: Option<Vec<#filter_name>>,
            /// Logical NOT: invert the condition.
            #[graphql(name = "_not")]
            pub not: Option<Box<#filter_name>>,
        }

        impl #filter_name {
            /// Convert this filter into a SeaORM `Condition` tree.
            pub fn to_condition(&self) -> sea_orm::Condition {
                use sea_orm::ColumnTrait;
                let mut cond = sea_orm::Condition::all();
                #(#filter_conditions)*
                #(#assoc_filter_conditions)*
                if let Some(ref ands) = self.and {
                    for a in ands {
                        cond = cond.add(a.to_condition());
                    }
                }
                if let Some(ref ors) = self.or {
                    let mut or_cond = sea_orm::Condition::any();
                    for o in ors {
                        or_cond = or_cond.add(o.to_condition());
                    }
                    cond = cond.add(or_cond);
                }
                if let Some(ref not) = self.not {
                    cond = cond.add(sea_orm::Condition::not(not.to_condition()));
                }
                cond
            }
        }

        /// Auto-generated ordering input type.
        #[derive(async_graphql::InputObject, Default, Clone, Debug)]
        #[graphql(name = #order_by_name_str)]
        pub struct #order_by_name {
            #(#order_fields)*
        }

        impl #order_by_name {
            /// Apply ordering to a SeaORM Select query.
            pub fn apply(&self, mut query: sea_orm::Select<#entity_path>) -> sea_orm::Select<#entity_path> {
                use sea_orm::QueryOrder;
                #(#order_applications)*
                query
            }
        }
    };

    expanded.into()
}
