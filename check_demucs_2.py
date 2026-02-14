from demucs.apply import apply_model
import inspect

sig = inspect.signature(apply_model)
print("Parameters:", list(sig.parameters.keys()))
