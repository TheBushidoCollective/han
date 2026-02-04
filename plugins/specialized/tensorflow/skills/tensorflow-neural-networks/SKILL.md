---
name: tensorflow-neural-networks
description: Build and train neural networks with TensorFlow
allowed-tools: [Bash, Read]
---

# TensorFlow Neural Networks

Build and train neural networks using TensorFlow's high-level Keras API and low-level custom implementations. This skill covers everything from simple sequential models to complex custom architectures with multiple outputs, custom layers, and advanced training techniques.

## Sequential Models with Keras

The Sequential API provides the simplest way to build neural networks by stacking layers linearly.

### Basic Image Classification

```python
import tensorflow as tf
from tensorflow import keras
import numpy as np

# Load MNIST dataset
(x_train, y_train), (x_test, y_test) = keras.datasets.mnist.load_data()

# Preprocess data
x_train = x_train.astype('float32') / 255.0
x_test = x_test.astype('float32') / 255.0
x_train = x_train.reshape(-1, 28 * 28)
x_test = x_test.reshape(-1, 28 * 28)

# Build Sequential model
model = keras.Sequential([
    keras.layers.Dense(128, activation='relu', input_shape=(784,)),
    keras.layers.Dropout(0.2),
    keras.layers.Dense(64, activation='relu'),
    keras.layers.Dropout(0.2),
    keras.layers.Dense(10, activation='softmax')
])

# Compile model
model.compile(
    optimizer='adam',
    loss='sparse_categorical_crossentropy',
    metrics=['accuracy']
)

# Display model architecture
model.summary()

# Train model
history = model.fit(
    x_train, y_train,
    batch_size=32,
    epochs=5,
    validation_split=0.2,
    verbose=1
)

# Evaluate model
test_loss, test_accuracy = model.evaluate(x_test, y_test, verbose=0)
print(f"Test accuracy: {test_accuracy:.4f}")

# Make predictions
predictions = model.predict(x_test[:5])
predicted_classes = np.argmax(predictions, axis=1)
print(f"Predicted classes: {predicted_classes}")
print(f"True classes: {y_test[:5]}")

# Save model
model.save('mnist_model.h5')

# Load model
loaded_model = keras.models.load_model('mnist_model.h5')
```

### Convolutional Neural Network

```python
def create_cnn_model(input_shape=(224, 224, 3), num_classes=1000):
    """Create CNN model for image classification."""
    model = tf.keras.Sequential([
        # Block 1
        tf.keras.layers.Conv2D(64, (3, 3), activation='relu', padding='same',
                               input_shape=input_shape),
        tf.keras.layers.Conv2D(64, (3, 3), activation='relu', padding='same'),
        tf.keras.layers.MaxPooling2D((2, 2)),
        tf.keras.layers.BatchNormalization(),

        # Block 2
        tf.keras.layers.Conv2D(128, (3, 3), activation='relu', padding='same'),
        tf.keras.layers.Conv2D(128, (3, 3), activation='relu', padding='same'),
        tf.keras.layers.MaxPooling2D((2, 2)),
        tf.keras.layers.BatchNormalization(),

        # Block 3
        tf.keras.layers.Conv2D(256, (3, 3), activation='relu', padding='same'),
        tf.keras.layers.Conv2D(256, (3, 3), activation='relu', padding='same'),
        tf.keras.layers.MaxPooling2D((2, 2)),
        tf.keras.layers.BatchNormalization(),

        # Classification head
        tf.keras.layers.GlobalAveragePooling2D(),
        tf.keras.layers.Dense(512, activation='relu'),
        tf.keras.layers.Dropout(0.5),
        tf.keras.layers.Dense(num_classes, activation='softmax')
    ])
    return model
```

### CIFAR-10 CNN Architecture

```python
def generate_model():
    return tf.keras.models.Sequential([
        tf.keras.layers.Conv2D(32, (3, 3), padding='same', input_shape=x_train.shape[1:]),
        tf.keras.layers.Activation('relu'),
        tf.keras.layers.Conv2D(32, (3, 3)),
        tf.keras.layers.Activation('relu'),
        tf.keras.layers.MaxPooling2D(pool_size=(2, 2)),
        tf.keras.layers.Dropout(0.25),

        tf.keras.layers.Conv2D(64, (3, 3), padding='same'),
        tf.keras.layers.Activation('relu'),
        tf.keras.layers.Conv2D(64, (3, 3)),
        tf.keras.layers.Activation('relu'),
        tf.keras.layers.MaxPooling2D(pool_size=(2, 2)),
        tf.keras.layers.Dropout(0.25),

        tf.keras.layers.Flatten(),
        tf.keras.layers.Dense(512),
        tf.keras.layers.Activation('relu'),
        tf.keras.layers.Dropout(0.5),
        tf.keras.layers.Dense(10),
        tf.keras.layers.Activation('softmax')
    ])

model = generate_model()
```

## Custom Layers

Create reusable custom layers by subclassing `tf.keras.layers.Layer`.

### Custom Dense Layer

```python
import tensorflow as tf

class CustomDense(tf.keras.layers.Layer):
    def __init__(self, units=32, activation=None):
        super(CustomDense, self).__init__()
        self.units = units
        self.activation = tf.keras.activations.get(activation)

    def build(self, input_shape):
        """Create layer weights."""
        self.w = self.add_weight(
            shape=(input_shape[-1], self.units),
            initializer='glorot_uniform',
            trainable=True,
            name='kernel'
        )
        self.b = self.add_weight(
            shape=(self.units,),
            initializer='zeros',
            trainable=True,
            name='bias'
        )

    def call(self, inputs):
        """Forward pass."""
        output = tf.matmul(inputs, self.w) + self.b
        if self.activation is not None:
            output = self.activation(output)
        return output

    def get_config(self):
        """Enable serialization."""
        config = super().get_config()
        config.update({
            'units': self.units,
            'activation': tf.keras.activations.serialize(self.activation)
        })
        return config

# Use custom components
custom_model = tf.keras.Sequential([
    CustomDense(64, activation='relu', input_shape=(10,)),
    CustomDense(32, activation='relu'),
    CustomDense(1, activation='sigmoid')
])

custom_model.compile(optimizer='adam', loss='binary_crossentropy', metrics=['accuracy'])
```

### Residual Block

```python
import tensorflow as tf

class ResidualBlock(tf.keras.layers.Layer):
    def __init__(self, filters, kernel_size=3):
        super(ResidualBlock, self).__init__()
        self.conv1 = tf.keras.layers.Conv2D(filters, kernel_size, padding='same')
        self.bn1 = tf.keras.layers.BatchNormalization()
        self.conv2 = tf.keras.layers.Conv2D(filters, kernel_size, padding='same')
        self.bn2 = tf.keras.layers.BatchNormalization()
        self.activation = tf.keras.layers.Activation('relu')
        self.add = tf.keras.layers.Add()

    def call(self, inputs, training=False):
        x = self.conv1(inputs)
        x = self.bn1(x, training=training)
        x = self.activation(x)
        x = self.conv2(x)
        x = self.bn2(x, training=training)
        x = self.add([x, inputs])  # Residual connection
        x = self.activation(x)
        return x
```

### Custom Projection Layer with TF NumPy

```python
class ProjectionLayer(tf.keras.layers.Layer):
    """Linear projection layer using TF NumPy."""

    def __init__(self, units):
        super(ProjectionLayer, self).__init__()
        self._units = units

    def build(self, input_shape):
        import tensorflow.experimental.numpy as tnp
        stddev = tnp.sqrt(self._units).astype(tnp.float32)
        initial_value = tnp.random.randn(input_shape[1], self._units).astype(
            tnp.float32) / stddev
        # Note that TF NumPy can interoperate with tf.Variable.
        self.w = tf.Variable(initial_value, trainable=True)

    def call(self, inputs):
        import tensorflow.experimental.numpy as tnp
        return tnp.matmul(inputs, self.w)

# Call with ndarray inputs
layer = ProjectionLayer(2)
tnp_inputs = tnp.random.randn(2, 4).astype(tnp.float32)
print("output:", layer(tnp_inputs))

# Call with tf.Tensor inputs
tf_inputs = tf.random.uniform([2, 4])
print("\noutput: ", layer(tf_inputs))
```

## Custom Models

Build complex architectures by subclassing `tf.keras.Model`.

### Multi-Task Model

```python
import tensorflow as tf

class MultiTaskModel(tf.keras.Model):
    def __init__(self, num_classes_task1=10, num_classes_task2=5):
        super(MultiTaskModel, self).__init__()
        # Shared layers
        self.conv1 = tf.keras.layers.Conv2D(32, 3, activation='relu')
        self.pool = tf.keras.layers.MaxPooling2D()
        self.flatten = tf.keras.layers.Flatten()
        self.shared_dense = tf.keras.layers.Dense(128, activation='relu')

        # Task-specific layers
        self.task1_dense = tf.keras.layers.Dense(64, activation='relu')
        self.task1_output = tf.keras.layers.Dense(num_classes_task1,
                                                   activation='softmax', name='task1')

        self.task2_dense = tf.keras.layers.Dense(64, activation='relu')
        self.task2_output = tf.keras.layers.Dense(num_classes_task2,
                                                   activation='softmax', name='task2')

    def call(self, inputs, training=False):
        # Shared feature extraction
        x = self.conv1(inputs)
        x = self.pool(x)
        x = self.flatten(x)
        x = self.shared_dense(x)

        # Task 1 branch
        task1 = self.task1_dense(x)
        task1_output = self.task1_output(task1)

        # Task 2 branch
        task2 = self.task2_dense(x)
        task2_output = self.task2_output(task2)

        return task1_output, task2_output
```

### Three-Layer Neural Network Module

```python
class Model(tf.Module):
    """A three layer neural network."""

    def __init__(self):
        self.layer1 = Dense(128)
        self.layer2 = Dense(32)
        self.layer3 = Dense(NUM_CLASSES, use_relu=False)

    def __call__(self, inputs):
        x = self.layer1(inputs)
        x = self.layer2(x)
        return self.layer3(x)

    @property
    def params(self):
        return self.layer1.params + self.layer2.params + self.layer3.params
```

## Recurrent Neural Networks

### Custom GRU Cell

```python
import tensorflow.experimental.numpy as tnp

class GRUCell:
    """Builds a traditional GRU cell with dense internal transformations.

    Gated Recurrent Unit paper: https://arxiv.org/abs/1412.3555
    """

    def __init__(self, n_units, forget_bias=0.0):
        self._n_units = n_units
        self._forget_bias = forget_bias
        self._built = False

    def __call__(self, inputs):
        if not self._built:
            self.build(inputs)
        x, gru_state = inputs
        # Dense layer on the concatenation of x and h.
        y = tnp.dot(tnp.concatenate([x, gru_state], axis=-1), self.w1) + self.b1
        # Update and reset gates.
        u, r = tnp.split(tf.sigmoid(y), 2, axis=-1)
        # Candidate.
        c = tnp.dot(tnp.concatenate([x, r * gru_state], axis=-1), self.w2) + self.b2
        new_gru_state = u * gru_state + (1 - u) * tnp.tanh(c)
        return new_gru_state

    def build(self, inputs):
        # State last dimension must be n_units.
        assert inputs[1].shape[-1] == self._n_units
        # The dense layer input is the input and half of the GRU state.
        dense_shape = inputs[0].shape[-1] + self._n_units
        self.w1 = tf.Variable(tnp.random.uniform(
            -0.01, 0.01, (dense_shape, 2 * self._n_units)).astype(tnp.float32))
        self.b1 = tf.Variable((tnp.random.randn(2 * self._n_units) * 1e-6 + self._forget_bias
                   ).astype(tnp.float32))
        self.w2 = tf.Variable(tnp.random.uniform(
            -0.01, 0.01, (dense_shape, self._n_units)).astype(tnp.float32))
        self.b2 = tf.Variable((tnp.random.randn(self._n_units) * 1e-6).astype(tnp.float32))
        self._built = True

    @property
    def weights(self):
        return (self.w1, self.b1, self.w2, self.b2)
```

### Custom Dense Layer Implementation

```python
import tensorflow.experimental.numpy as tnp

class Dense:
    def __init__(self, n_units, activation=None):
        self._n_units = n_units
        self._activation = activation
        self._built = False

    def __call__(self, inputs):
        if not self._built:
            self.build(inputs)
        y = tnp.dot(inputs, self.w) + self.b
        if self._activation != None:
            y = self._activation(y)
        return y

    def build(self, inputs):
        shape_w = (inputs.shape[-1], self._n_units)
        lim = tnp.sqrt(6.0 / (shape_w[0] + shape_w[1]))
        self.w = tf.Variable(tnp.random.uniform(-lim, lim, shape_w).astype(tnp.float32))
        self.b = tf.Variable((tnp.random.randn(self._n_units) * 1e-6).astype(tnp.float32))
        self._built = True

    @property
    def weights(self):
        return (self.w, self.b)
```

### Sequential RNN Model

```python
class Model:
    def __init__(self, vocab_size, embedding_dim, rnn_units, forget_bias=0.0, stateful=False, activation=None):
        self._embedding = Embedding(vocab_size, embedding_dim)
        self._gru = GRU(rnn_units, forget_bias=forget_bias, stateful=stateful)
        self._dense = Dense(vocab_size, activation=activation)
        self._layers = [self._embedding, self._gru, self._dense]
        self._built = False

    def __call__(self, inputs):
        if not self._built:
            self.build(inputs)
        xs = inputs
        for layer in self._layers:
            xs = layer(xs)
        return xs

    def build(self, inputs):
        self._embedding.build(inputs)
        self._gru.build(tf.TensorSpec(inputs.shape + (self._embedding._embedding_dim,), tf.float32))
        self._dense.build(tf.TensorSpec(inputs.shape + (self._gru._cell._n_units,), tf.float32))
        self._built = True

    @property
    def weights(self):
        return [layer.weights for layer in self._layers]

    @property
    def state(self):
        return self._gru.state

    def create_state(self, *args):
        self._gru.create_state(*args)

    def reset_state(self, *args):
        self._gru.reset_state(*args)
```

## Training Configuration

### Model Parameters

```python
# Length of the vocabulary in chars
vocab_size = len(vocab)

# The embedding dimension
embedding_dim = 256

# Number of RNN units
rnn_units = 1024

# Batch size
BATCH_SIZE = 64

# Buffer size to shuffle the dataset
BUFFER_SIZE = 10000
```

### Training Constants for MNIST

```python
# Size of each input image, 28 x 28 pixels
IMAGE_SIZE = 28 * 28
# Number of distinct number labels, [0..9]
NUM_CLASSES = 10
# Number of examples in each training batch (step)
TRAIN_BATCH_SIZE = 100
# Number of training steps to run
TRAIN_STEPS = 1000

# Loads MNIST dataset.
train, test = tf.keras.datasets.mnist.load_data()
train_ds = tf.data.Dataset.from_tensor_slices(train).batch(TRAIN_BATCH_SIZE).repeat()

# Casting from raw data to the required datatypes.
def cast(images, labels):
    images = tf.cast(
        tf.reshape(images, [-1, IMAGE_SIZE]), tf.float32)
    labels = tf.cast(labels, tf.int64)
    return (images, labels)
```

### Post-Training Quantization

```python
# Load MNIST dataset
mnist = keras.datasets.mnist
(train_images, train_labels), (test_images, test_labels) = mnist.load_data()

# Normalize the input image so that each pixel value is between 0 to 1.
train_images = train_images / 255.0
test_images = test_images / 255.0

# Define the model architecture
model = keras.Sequential([
    keras.layers.InputLayer(input_shape=(28, 28)),
    keras.layers.Reshape(target_shape=(28, 28, 1)),
    keras.layers.Conv2D(filters=12, kernel_size=(3, 3), activation=tf.nn.relu),
    keras.layers.MaxPooling2D(pool_size=(2, 2)),
    keras.layers.Flatten(),
    keras.layers.Dense(10)
])

# Train the digit classification model
model.compile(optimizer='adam',
              loss=keras.losses.SparseCategoricalCrossentropy(from_logits=True),
              metrics=['accuracy'])
model.fit(
    train_images,
    train_labels,
    epochs=1,
    validation_data=(test_images, test_labels)
)
```

## When to Use This Skill

Use the tensorflow-neural-networks skill when you need to:

- Build image classification models with CNNs
- Create text processing models with RNNs or transformers
- Implement custom layer architectures for specific use cases
- Design multi-task learning models with shared representations
- Train sequential models for tabular data
- Implement residual connections or skip connections
- Create embedding layers for discrete inputs
- Build autoencoders or generative models
- Fine-tune pre-trained models with custom heads
- Implement attention mechanisms in custom architectures
- Create time-series prediction models
- Design reinforcement learning policy networks
- Build siamese networks for similarity learning
- Implement custom gradient computation in layers
- Create models with dynamic architectures based on input

## Best Practices

1. **Use Keras Sequential for simple architectures** - Start with Sequential API for linear layer stacks before moving to functional or subclassing APIs
2. **Leverage pre-built layers** - Use tf.keras.layers built-in implementations before creating custom layers
3. **Initialize weights properly** - Use appropriate initializers (glorot_uniform, he_normal) based on activation functions
4. **Add batch normalization** - Place BatchNormalization layers after Conv2D/Dense layers for training stability
5. **Use dropout for regularization** - Apply Dropout layers (0.2-0.5) to prevent overfitting in fully connected layers
6. **Compile before training** - Always call model.compile() with optimizer, loss, and metrics before fit()
7. **Monitor validation metrics** - Use validation_split or validation_data to track overfitting during training
8. **Save model checkpoints** - Implement ModelCheckpoint callback to save best models during training
9. **Use model.summary()** - Verify architecture and parameter counts before training
10. **Implement early stopping** - Add EarlyStopping callback to prevent unnecessary training iterations
11. **Normalize input data** - Scale pixel values to [0,1] or standardize features to mean=0, std=1
12. **Use appropriate activation functions** - ReLU for hidden layers, softmax for multi-class, sigmoid for binary
13. **Set proper loss functions** - sparse_categorical_crossentropy for integer labels, categorical_crossentropy for one-hot
14. **Implement custom get_config()** - Override get_config() in custom layers for model serialization
15. **Use training parameter in call()** - Pass training flag to enable/disable dropout and batch norm behavior

## Common Pitfalls

1. **Forgetting to normalize data** - Unnormalized inputs cause slow convergence and poor performance
2. **Wrong loss function for labels** - Using categorical_crossentropy with integer labels causes errors
3. **Missing input_shape** - First layer needs input_shape parameter for model building
4. **Overfitting on small datasets** - Add dropout, augmentation, or reduce model capacity
5. **Learning rate too high** - Causes unstable training and loss divergence
6. **Not shuffling training data** - Leads to biased batch statistics and poor generalization
7. **Batch size too small** - Causes noisy gradients and slow training on large datasets
8. **Too many parameters** - Large models overfit and train slowly on limited data
9. **Vanishing gradients in deep networks** - Use residual connections or batch normalization
10. **Not using validation data** - Cannot detect overfitting or tune hyperparameters properly
11. **Forgetting to set training=False** - Dropout/BatchNorm behave incorrectly during inference
12. **Incompatible layer dimensions** - Output shape of one layer must match input of next
13. **Not calling build() before weights** - Custom layers need proper initialization before accessing weights
14. **Using wrong optimizer** - Adam works well generally, but SGD with momentum for some tasks
15. **Ignoring class imbalance** - Implement class weights or resampling for imbalanced datasets

## Resources

- [TensorFlow Keras Guide](https://www.tensorflow.org/guide/keras)
- [Building Custom Layers](https://www.tensorflow.org/guide/keras/custom_layers_and_models)
- [Training and Evaluation](https://www.tensorflow.org/guide/keras/train_and_evaluate)
- [Sequential Model API](https://www.tensorflow.org/api_docs/python/tf/keras/Sequential)
- [Model Subclassing Guide](https://www.tensorflow.org/guide/keras/custom_layers_and_models#the_model_class)
- [RNN Guide](https://www.tensorflow.org/guide/keras/rnn)
- [Custom Training Loops](https://www.tensorflow.org/guide/keras/writing_a_training_loop_from_scratch)
- [Transfer Learning Guide](https://www.tensorflow.org/tutorials/images/transfer_learning)
