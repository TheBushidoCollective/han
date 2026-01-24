//! Embedding generation using ONNX Runtime
//!
//! Uses ort with load-dynamic feature for runtime loading of ONNX Runtime.
//! Downloads ONNX Runtime and model on first use.

use crate::download;
use ndarray::Array2;
use ort::session::{builder::GraphOptimizationLevel, Session};
use ort::value::Value;
use serde::Deserialize;
use std::collections::HashMap;
use std::fs;
use std::sync::OnceLock;
use tokio::sync::Mutex;

// Global session (lazy initialized)
static SESSION: OnceLock<Mutex<Option<EmbeddingSession>>> = OnceLock::new();

struct EmbeddingSession {
    session: Session,
    tokenizer: Tokenizer,
}

/// Simple tokenizer wrapper
struct Tokenizer {
    vocab: HashMap<String, i64>,
    unk_token_id: i64,
    cls_token_id: i64,
    sep_token_id: i64,
    pad_token_id: i64,
    max_length: usize,
}

#[derive(Deserialize)]
struct TokenizerJson {
    model: TokenizerModel,
    added_tokens: Vec<AddedToken>,
}

#[derive(Deserialize)]
struct TokenizerModel {
    vocab: HashMap<String, i64>,
}

#[derive(Deserialize)]
struct AddedToken {
    id: i64,
    content: String,
}

impl Tokenizer {
    fn from_file(path: &str) -> Result<Self, String> {
        let content =
            fs::read_to_string(path).map_err(|e| format!("Failed to read tokenizer: {}", e))?;

        let json: TokenizerJson = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse tokenizer: {}", e))?;

        let vocab = json.model.vocab;

        // Find special token IDs
        let mut unk_token_id = 100; // Default for BERT-based
        let mut cls_token_id = 101;
        let mut sep_token_id = 102;
        let mut pad_token_id = 0;

        for token in json.added_tokens {
            match token.content.as_str() {
                "[UNK]" => unk_token_id = token.id,
                "[CLS]" => cls_token_id = token.id,
                "[SEP]" => sep_token_id = token.id,
                "[PAD]" => pad_token_id = token.id,
                _ => {}
            }
        }

        Ok(Self {
            vocab,
            unk_token_id,
            cls_token_id,
            sep_token_id,
            pad_token_id,
            max_length: 512,
        })
    }

    fn encode(&self, text: &str) -> (Vec<i64>, Vec<i64>) {
        // Simple whitespace + subword tokenization
        let mut input_ids = vec![self.cls_token_id];
        let mut attention_mask = vec![1i64];

        // Basic tokenization: lowercase and split by whitespace/punctuation
        let text = text.to_lowercase();
        let words: Vec<&str> = text
            .split(|c: char| c.is_whitespace() || c.is_ascii_punctuation())
            .filter(|s| !s.is_empty())
            .collect();

        for word in words {
            if input_ids.len() >= self.max_length - 1 {
                break;
            }

            // Try to find the word in vocab, or use subword pieces
            if let Some(&id) = self.vocab.get(word) {
                input_ids.push(id);
                attention_mask.push(1);
            } else {
                // Try with ## prefix for subwords
                let prefixed = format!("##{}", word);
                if let Some(&id) = self.vocab.get(&prefixed) {
                    input_ids.push(id);
                    attention_mask.push(1);
                } else {
                    // Fall back to UNK
                    input_ids.push(self.unk_token_id);
                    attention_mask.push(1);
                }
            }
        }

        // Add SEP token
        input_ids.push(self.sep_token_id);
        attention_mask.push(1);

        // Pad to max_length for batch processing
        while input_ids.len() < self.max_length {
            input_ids.push(self.pad_token_id);
            attention_mask.push(0);
        }

        (input_ids, attention_mask)
    }
}

/// Check if ONNX Runtime and model are available
pub async fn is_available() -> napi::Result<bool> {
    let ort_available = download::is_onnxruntime_available().await;
    let model_available = download::is_model_available().await;
    Ok(ort_available && model_available)
}

/// Ensure ONNX Runtime and model are downloaded
pub async fn ensure_available() -> napi::Result<String> {
    // Download ONNX Runtime if needed
    let lib_path = download::ensure_onnxruntime()
        .await
        .map_err(napi::Error::from_reason)?;

    // Set environment variable for ort to find the library
    std::env::set_var("ORT_DYLIB_PATH", &lib_path);

    // Download model if needed
    download::ensure_model()
        .await
        .map_err(napi::Error::from_reason)?;

    Ok(lib_path.to_string_lossy().to_string())
}

/// Get or create the embedding session
async fn get_session() -> napi::Result<tokio::sync::MutexGuard<'static, Option<EmbeddingSession>>> {
    let cell = SESSION.get_or_init(|| Mutex::new(None));
    let mut guard = cell.lock().await;

    if guard.is_none() {
        // Ensure dependencies are downloaded
        ensure_available().await?;

        // Initialize ort
        ort::init().commit().map_err(|e| {
            napi::Error::from_reason(format!("Failed to initialize ONNX Runtime: {}", e))
        })?;

        // Load the model
        let model_path = download::get_model_path();
        let session = Session::builder()
            .map_err(|e| {
                napi::Error::from_reason(format!("Failed to create session builder: {}", e))
            })?
            .with_optimization_level(GraphOptimizationLevel::Level3)
            .map_err(|e| {
                napi::Error::from_reason(format!("Failed to set optimization level: {}", e))
            })?
            .commit_from_file(&model_path)
            .map_err(|e| napi::Error::from_reason(format!("Failed to load model: {}", e)))?;

        // Load tokenizer
        let tokenizer_path = download::get_tokenizer_path();
        let tokenizer = Tokenizer::from_file(&tokenizer_path.to_string_lossy())
            .map_err(napi::Error::from_reason)?;

        *guard = Some(EmbeddingSession { session, tokenizer });
    }

    Ok(guard)
}

/// Generate embeddings for multiple texts
pub async fn generate_embeddings(texts: Vec<String>) -> napi::Result<Vec<Vec<f32>>> {
    if texts.is_empty() {
        return Ok(Vec::new());
    }

    let mut guard = get_session().await?;
    let session_data = guard
        .as_mut()
        .ok_or_else(|| napi::Error::from_reason("Embedding session not initialized".to_string()))?;

    let batch_size = texts.len();
    let seq_len = session_data.tokenizer.max_length;

    // Tokenize all texts
    let mut all_input_ids = Vec::with_capacity(batch_size * seq_len);
    let mut all_attention_mask = Vec::with_capacity(batch_size * seq_len);
    let mut all_token_type_ids = Vec::with_capacity(batch_size * seq_len);

    for text in &texts {
        let (input_ids, attention_mask) = session_data.tokenizer.encode(text);
        all_input_ids.extend(input_ids);
        all_attention_mask.extend(attention_mask);
        all_token_type_ids.extend(vec![0i64; seq_len]); // All zeros for single sequence
    }

    // Create input arrays
    let input_ids = Array2::from_shape_vec((batch_size, seq_len), all_input_ids).map_err(|e| {
        napi::Error::from_reason(format!("Failed to create input_ids array: {}", e))
    })?;
    let attention_mask = Array2::from_shape_vec((batch_size, seq_len), all_attention_mask)
        .map_err(|e| {
            napi::Error::from_reason(format!("Failed to create attention_mask array: {}", e))
        })?;
    let token_type_ids = Array2::from_shape_vec((batch_size, seq_len), all_token_type_ids)
        .map_err(|e| {
            napi::Error::from_reason(format!("Failed to create token_type_ids array: {}", e))
        })?;

    // Create input tensors (pass owned arrays, not views)
    let input_ids_value = Value::from_array(input_ids).map_err(|e| {
        napi::Error::from_reason(format!("Failed to create input_ids tensor: {}", e))
    })?;
    let attention_mask_value = Value::from_array(attention_mask).map_err(|e| {
        napi::Error::from_reason(format!("Failed to create attention_mask tensor: {}", e))
    })?;
    let token_type_ids_value = Value::from_array(token_type_ids).map_err(|e| {
        napi::Error::from_reason(format!("Failed to create token_type_ids tensor: {}", e))
    })?;

    // Run inference
    let outputs = session_data
        .session
        .run(ort::inputs![
            "input_ids" => input_ids_value,
            "attention_mask" => attention_mask_value,
            "token_type_ids" => token_type_ids_value,
        ])
        .map_err(|e| napi::Error::from_reason(format!("Failed to run inference: {}", e)))?;

    // Extract embeddings (last_hidden_state or sentence_embedding depending on model)
    // all-MiniLM-L6-v2 outputs sentence_embedding directly
    let output_name = if outputs.contains_key("sentence_embedding") {
        "sentence_embedding"
    } else {
        "last_hidden_state"
    };

    let output_tensor = outputs
        .get(output_name)
        .ok_or_else(|| napi::Error::from_reason(format!("Output '{}' not found", output_name)))?;

    // Extract tensor data - returns (shape, data slice)
    let (shape, data_slice) = output_tensor
        .try_extract_tensor::<f32>()
        .map_err(|e| napi::Error::from_reason(format!("Failed to extract tensor: {}", e)))?;

    let dims: Vec<usize> = shape.iter().map(|&d| d as usize).collect();
    let data: &[f32] = data_slice;

    let embeddings: Vec<Vec<f32>> = if dims.len() == 2 {
        // Shape: (batch_size, hidden_size) - direct sentence embeddings
        let hidden_size = dims[1];
        data.chunks(hidden_size)
            .map(|chunk| chunk.to_vec())
            .collect()
    } else if dims.len() == 3 {
        // Shape: (batch_size, seq_len, hidden_size) - need mean pooling
        let seq_len = dims[1];
        let hidden_size = dims[2];
        let batch_stride = seq_len * hidden_size;

        (0..batch_size)
            .map(|i| {
                let batch_start = i * batch_stride;
                let batch_data = &data[batch_start..batch_start + batch_stride];

                // Mean pooling over sequence dimension
                let mut mean = vec![0.0f32; hidden_size];
                for token_idx in 0..seq_len {
                    let token_start = token_idx * hidden_size;
                    for (j, val) in batch_data[token_start..token_start + hidden_size]
                        .iter()
                        .enumerate()
                    {
                        mean[j] += val;
                    }
                }
                for val in &mut mean {
                    *val /= seq_len as f32;
                }
                mean
            })
            .collect()
    } else {
        return Err(napi::Error::from_reason(format!(
            "Unexpected output shape: {:?}",
            dims
        )));
    };

    // Normalize embeddings (L2 norm)
    let normalized: Vec<Vec<f32>> = embeddings
        .into_iter()
        .map(|emb| {
            let norm: f32 = emb.iter().map(|x| x * x).sum::<f32>().sqrt();
            if norm > 0.0 {
                emb.into_iter().map(|x| x / norm).collect()
            } else {
                emb
            }
        })
        .collect();

    Ok(normalized)
}

/// Generate embedding for a single text
pub async fn generate_embedding(text: String) -> napi::Result<Vec<f32>> {
    let embeddings = generate_embeddings(vec![text]).await?;
    embeddings
        .into_iter()
        .next()
        .ok_or_else(|| napi::Error::from_reason("No embedding returned".to_string()))
}
