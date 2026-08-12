//! GraphQLEntity derive macro implementation.
//!
//! Generates a full GraphQL type: SimpleObject + From<Model> + Filter + OrderBy.
//!
//! Supports association filtering via `#[graphql_entity(assoc(...))]` on marker
//! fields (typed `()`). These fields are skipped in `From<Model>` and generate
//! nested filter fields with `IN (SELECT ...)` subquery conditions.

use convert_case::{Case, Casing};
use proc_macro::TokenStream;
use proc_macro2::TokenStream as TokenStream2;
use quote::{format_ident, quote};
use syn::{parse_macro_input, Data, DeriveInput, Fields, Lit, Meta};

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

/// Container-level attributes from #[graphql_entity(...)].
struct ContainerAttrs {
    model_path: syn::Path,
    entity_path: syn::Path,
    columns_path: syn::Path,
    type_name: String,
}

fn parse_container_attrs(input: &DeriveInput) -> ContainerAttrs {
    let mut model_str = None;
    let mut entity_str = None;
    let mut columns_str = None;
    let mut type_name = None;

    for attr in &input.attrs {
        if !attr.path().is_ident("graphql_entity") {
            continue;
        }
        let nested = attr
            .parse_args_with(syn::punctuated::Punctuated::<Meta, syn::Token![,]>::parse_terminated)
            .expect("Failed to parse graphql_entity attributes");

        for meta in &nested {
            if let Some(v) = meta_string(meta, "model") {
                model_str = Some(v);
            }
            if let Some(v) = meta_string(meta, "entity") {
                entity_str = Some(v);
            }
            if let Some(v) = meta_string(meta, "columns") {
                columns_str = Some(v);
            }
            if let Some(v) = meta_string(meta, "type_name") {
                type_name = Some(v);
            }
        }
    }

    ContainerAttrs {
        model_path: syn::parse_str(&model_str.expect("graphql_entity requires `model`"))
            .expect("Invalid model path"),
        entity_path: syn::parse_str(&entity_str.expect("graphql_entity requires `entity`"))
            .expect("Invalid entity path"),
        columns_path: syn::parse_str(&columns_str.expect("graphql_entity requires `columns`"))
            .expect("Invalid columns path"),
        type_name: type_name.expect("graphql_entity requires `type_name`"),
    }
}

/// Field-level attributes from #[graphql_entity(...)].
struct FieldAttrs {
    skip: bool,
    id_field: bool,
    encode_type: Option<String>,
    transform: Option<String>,
    source_type: Option<String>,
    source_field: Option<String>,
    rename: Option<String>,
    assoc: Option<AssocDecl>,
}

/// Parsed association declaration from `#[graphql_entity(assoc(...))]`.
struct AssocDecl {
    /// Path to the associated entity's filter type.
    filter_type: syn::Path,
    /// Local column variant on *this* entity (e.g. `ProjectId`).
    local_column: syn::Ident,
    /// SeaORM Entity path for the foreign entity.
    foreign_entity: syn::Path,
    /// Full column path for the foreign key (e.g. `projects::Column::Id`).
    foreign_column: syn::Path,
}

fn parse_field_attrs(field: &syn::Field) -> FieldAttrs {
    let mut attrs = FieldAttrs {
        skip: false,
        id_field: false,
        encode_type: None,
        transform: None,
        source_type: None,
        source_field: None,
        rename: None,
        assoc: None,
    };

    for attr in &field.attrs {
        if !attr.path().is_ident("graphql_entity") {
            continue;
        }
        if let Ok(nested) = attr
            .parse_args_with(syn::punctuated::Punctuated::<Meta, syn::Token![,]>::parse_terminated)
        {
            for meta in &nested {
                match meta {
                    Meta::Path(p) => {
                        if p.is_ident("skip") {
                            attrs.skip = true;
                        }
                        if p.is_ident("id_field") {
                            attrs.id_field = true;
                        }
                    }
                    Meta::List(list) if list.path.is_ident("assoc") => {
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

                        attrs.assoc = Some(AssocDecl {
                            filter_type: syn::parse_str(
                                &filter_str.expect("assoc() requires `filter`"),
                            )
                            .expect("Invalid assoc filter path"),
                            local_column: format_ident!(
                                "{}",
                                local_col_str.expect("assoc() requires `local_column`")
                            ),
                            foreign_entity: syn::parse_str(
                                &foreign_ent_str.expect("assoc() requires `foreign_entity`"),
                            )
                            .expect("Invalid assoc foreign_entity path"),
                            foreign_column: syn::parse_str(
                                &foreign_col_str.expect("assoc() requires `foreign_column`"),
                            )
                            .expect("Invalid assoc foreign_column path"),
                        });
                        // Association fields are implicitly skipped from From<Model> and SimpleObject
                        attrs.skip = true;
                    }
                    _ => {
                        if let Some(v) = meta_string(meta, "encode") {
                            attrs.encode_type = Some(v);
                        }
                        if let Some(v) = meta_string(meta, "transform") {
                            attrs.transform = Some(v);
                        }
                        if let Some(v) = meta_string(meta, "source_type") {
                            attrs.source_type = Some(v);
                        }
                        if let Some(v) = meta_string(meta, "source_field") {
                            attrs.source_field = Some(v);
                        }
                        if let Some(v) = meta_string(meta, "rename") {
                            attrs.rename = Some(v);
                        }
                    }
                }
            }
        }
    }

    attrs
}

/// Determine the filter type for a given Rust type string.
fn filter_type_for_str(ty_str: &str) -> Option<TokenStream2> {
    let inner = if ty_str.starts_with("Option < ") {
        ty_str
            .strip_prefix("Option < ")
            .and_then(|s| s.strip_suffix(" >"))
            .unwrap_or(ty_str)
    } else {
        ty_str
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

pub fn derive(input: TokenStream) -> TokenStream {
    let input = parse_macro_input!(input as DeriveInput);
    let container = parse_container_attrs(&input);
    let struct_name = &input.ident;
    let type_name = &container.type_name;
    let model_path = &container.model_path;
    let columns_path = &container.columns_path;
    let entity_path = &container.entity_path;

    let filter_name = format_ident!("{}Filter", type_name);
    let order_by_name = format_ident!("{}OrderBy", type_name);
    let filter_name_str = format!("{}Filter", type_name);
    let order_by_name_str = format!("{}OrderBy", type_name);

    let fields = match &input.data {
        Data::Struct(data) => match &data.fields {
            Fields::Named(f) => &f.named,
            _ => panic!("GraphQLEntity only supports named fields"),
        },
        _ => panic!("GraphQLEntity only supports structs"),
    };

    // Collect field data
    let mut from_fields = Vec::new();
    let mut filter_fields = Vec::new();
    let mut filter_conditions = Vec::new();
    let mut order_fields = Vec::new();
    let mut order_applications = Vec::new();
    let mut assoc_filter_fields = Vec::new();
    let mut assoc_filter_conditions = Vec::new();

    for field in fields {
        let field_name = field.ident.as_ref().unwrap();
        let field_ty = &field.ty;
        let attrs = parse_field_attrs(field);

        // Handle association fields — skip from From<Model>, add to filter
        if let Some(ref assoc) = attrs.assoc {
            let gql_name = field_name.to_string().to_case(Case::Camel);
            let filter_ty = &assoc.filter_type;
            let local_col = &assoc.local_column;
            let foreign_ent = &assoc.foreign_entity;
            let foreign_col = &assoc.foreign_column;

            assoc_filter_fields.push(quote! {
                /// Association filter (auto-generated).
                #[graphql(name = #gql_name)]
                pub #field_name: Option<#filter_ty>,
            });

            assoc_filter_conditions.push(quote! {
                if let Some(ref assoc_filter) = self.#field_name {
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

            // Skip From<Model> mapping for association marker fields
            continue;
        }

        // From<Model> field mapping
        let source_field_name = attrs
            .source_field
            .as_ref()
            .map(|s| format_ident!("{}", s))
            .unwrap_or_else(|| field_name.clone());

        let from_expr = if let Some(ref transform) = attrs.transform {
            let transform_ident = format_ident!("{}", transform);
            quote! { #transform_ident(m.#source_field_name) }
        } else {
            quote! { m.#source_field_name }
        };

        from_fields.push(quote! {
            #field_name: #from_expr,
        });

        // Skip fields excluded from GraphQL/filter
        if attrs.skip {
            continue;
        }

        // Filter type
        let ty_str = quote!(#field_ty).to_string();
        if let Some(filter_ty) = filter_type_for_str(&ty_str) {
            let graphql_name = attrs
                .rename
                .clone()
                .unwrap_or_else(|| field_name.to_string().to_case(Case::Camel));
            let column_variant = format_ident!("{}", field_name.to_string().to_case(Case::Pascal));

            filter_fields.push(quote! {
                #[graphql(name = #graphql_name)]
                pub #field_name: Option<#filter_ty>,
            });

            filter_conditions.push(quote! {
                if let Some(ref f) = self.#field_name {
                    cond = cond.add(crate::filters::apply::ApplyFilter::apply(f, #columns_path::#column_variant));
                }
            });

            order_fields.push(quote! {
                #[graphql(name = #graphql_name)]
                pub #field_name: Option<crate::filters::ordering::OrderDirection>,
            });

            order_applications.push(quote! {
                if let Some(dir) = self.#field_name {
                    query = query.order_by(#columns_path::#column_variant, dir.into());
                }
            });
        }
    }

    let expanded = quote! {
        /// Auto-generated From<Model> impl.
        impl From<#model_path> for #struct_name {
            fn from(m: #model_path) -> Self {
                Self {
                    #(#from_fields)*
                }
            }
        }

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
