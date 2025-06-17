"""
Memory Management Module for SoundDitect

This module provides memory monitoring, optimization, and management utilities
to ensure training stays within specified memory limits.
"""

import gc
import os
import psutil
import torch
import logging
from typing import Dict, Optional, Tuple
from pathlib import Path
import time

logger = logging.getLogger(__name__)

class MemoryManager:
    """
    Memory manager for monitoring and optimizing memory usage during training.
    
    Provides tools for:
    - Real-time memory monitoring
    - Memory cleanup and optimization
    - Memory-efficient training configurations
    - GPU memory management
    """
    
    def __init__(self, config: dict):
        """
        Initialize memory manager.
        
        Args:
            config: Configuration dictionary containing memory settings
        """
        self.config = config
        self.max_memory_gb = self._parse_memory_limit(config['data']['max_memory_usage'])
        self.gradient_accumulation_steps = config['data'].get('gradient_accumulation_steps', 1)
        self.memory_efficient_attention = config['data'].get('memory_efficient_attention', False)
        
        # Memory monitoring
        self.process = psutil.Process(os.getpid())
        self.initial_memory = self.get_memory_usage()
        self.peak_memory = self.initial_memory
        self.memory_history = []
        
        # GPU memory tracking
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.gpu_available = torch.cuda.is_available()
        
        logger.info(f"Memory Manager initialized:")
        logger.info(f"  Max memory limit: {self.max_memory_gb:.1f} GB")
        logger.info(f"  Initial memory usage: {self.initial_memory:.2f} GB")
        logger.info(f"  Gradient accumulation steps: {self.gradient_accumulation_steps}")
        logger.info(f"  Memory-efficient attention: {self.memory_efficient_attention}")
        logger.info(f"  GPU available: {self.gpu_available}")
    
    def _parse_memory_limit(self, limit_str: str) -> float:
        """Parse memory limit string to GB float."""
        limit_str = limit_str.upper().strip()
        if limit_str.endswith('GB'):
            return float(limit_str[:-2])
        elif limit_str.endswith('MB'):
            return float(limit_str[:-2]) / 1024
        else:
            # Assume GB if no unit specified
            return float(limit_str)
    
    def get_memory_usage(self) -> float:
        """Get current memory usage in GB."""
        try:
            memory_info = self.process.memory_info()
            return memory_info.rss / (1024 ** 3)  # Convert bytes to GB
        except Exception as e:
            logger.warning(f"Could not get memory usage: {e}")
            return 0.0
    
    def get_gpu_memory_usage(self) -> Tuple[float, float]:
        """
        Get GPU memory usage.
        
        Returns:
            Tuple of (used_gb, total_gb)
        """
        if not self.gpu_available:
            return 0.0, 0.0
        
        try:
            torch.cuda.synchronize()
            used = torch.cuda.memory_allocated() / (1024 ** 3)
            total = torch.cuda.get_device_properties(0).total_memory / (1024 ** 3)
            return used, total
        except Exception as e:
            logger.warning(f"Could not get GPU memory usage: {e}")
            return 0.0, 0.0
    
    def monitor_memory(self, operation: str = "Training") -> Dict[str, float]:
        """
        Monitor current memory usage and update statistics.
        
        Args:
            operation: Description of current operation
            
        Returns:
            Dictionary with memory statistics
        """
        current_memory = self.get_memory_usage()
        gpu_used, gpu_total = self.get_gpu_memory_usage()
        
        # Update peak memory
        if current_memory > self.peak_memory:
            self.peak_memory = current_memory
        
        # Store in history (keep last 100 entries)
        self.memory_history.append({
            'timestamp': time.time(),
            'operation': operation,
            'memory_gb': current_memory,
            'gpu_memory_gb': gpu_used
        })
        if len(self.memory_history) > 100:
            self.memory_history.pop(0)
        
        stats = {
            'current_memory_gb': current_memory,
            'peak_memory_gb': self.peak_memory,
            'memory_growth_gb': current_memory - self.initial_memory,
            'memory_limit_gb': self.max_memory_gb,
            'memory_usage_percent': (current_memory / self.max_memory_gb) * 100,
            'gpu_memory_used_gb': gpu_used,
            'gpu_memory_total_gb': gpu_total,
            'gpu_memory_percent': (gpu_used / gpu_total * 100) if gpu_total > 0 else 0
        }
        
        # Log memory usage periodically
        if len(self.memory_history) % 10 == 0:
            logger.debug(f"Memory usage [{operation}]: {current_memory:.2f} GB "
                        f"({stats['memory_usage_percent']:.1f}% of limit)")
            if self.gpu_available:
                logger.debug(f"GPU memory: {gpu_used:.2f}/{gpu_total:.2f} GB "
                            f"({stats['gpu_memory_percent']:.1f}%)")
        
        return stats
    
    def check_memory_limit(self, operation: str = "Training") -> bool:
        """
        Check if memory usage is within limits.
        
        Args:
            operation: Description of current operation
            
        Returns:
            True if within limits, False if exceeded
        """
        stats = self.monitor_memory(operation)
        
        if stats['current_memory_gb'] > self.max_memory_gb:
            logger.error(f"MEMORY LIMIT EXCEEDED: {stats['current_memory_gb']:.2f} GB > {self.max_memory_gb:.2f} GB")
            logger.error("Performing emergency memory cleanup...")
            self.cleanup_memory(aggressive=True)
            return False
            
        # More aggressive warnings for critical operations
        critical_operations = ["Model creation", "Model initialization", "Training start"]
        warning_threshold = 70 if any(op in operation for op in critical_operations) else 80
        
        if stats['memory_usage_percent'] > warning_threshold:
            logger.warning(f"High memory usage: {stats['memory_usage_percent']:.1f}% of limit during {operation}")
            if stats['memory_usage_percent'] > 85:
                logger.warning("Performing preventive memory cleanup...")
                self.cleanup_memory(aggressive=True)
        
        return True
    
    def cleanup_memory(self, aggressive: bool = False):
        """
        Perform memory cleanup operations.
        
        Args:
            aggressive: Whether to perform aggressive cleanup
        """
        initial_memory = self.get_memory_usage()
        
        # Standard cleanup
        gc.collect()
        
        # GPU memory cleanup
        if self.gpu_available:
            torch.cuda.empty_cache()
            torch.cuda.synchronize()
        
        # Aggressive cleanup if needed
        if aggressive:
            # Force multiple garbage collection cycles
            for _ in range(5):
                gc.collect()
            
            # Clear Python caches
            if hasattr(gc, 'set_debug'):
                gc.set_debug(0)
                
            # Additional PyTorch cleanup
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
                torch.cuda.synchronize()
                torch.cuda.reset_peak_memory_stats()
        
        final_memory = self.get_memory_usage()
        freed_memory = initial_memory - final_memory
        
        if freed_memory > 0.01:  # Only log if significant memory was freed
            logger.info(f"Memory cleanup freed {freed_memory:.2f} GB "
                       f"(from {initial_memory:.2f} to {final_memory:.2f} GB)")
        
        return freed_memory
    
    def enforce_memory_limit(self, operation: str = "Operation") -> bool:
        """
        Strictly enforce memory limit with emergency cleanup if needed.
        
        Args:
            operation: Description of current operation
            
        Returns:
            True if memory is under control, False if critical
        """
        current_memory = self.get_memory_usage()
        
        if current_memory > self.max_memory_gb:
            logger.error(f"CRITICAL: Memory limit exceeded during {operation}")
            logger.error(f"Current: {current_memory:.2f} GB, Limit: {self.max_memory_gb:.2f} GB")
            
            # Emergency cleanup
            freed = self.cleanup_memory(aggressive=True)
            
            # Check again after cleanup
            new_memory = self.get_memory_usage()
            if new_memory > self.max_memory_gb:
                logger.error(f"CRITICAL: Memory still over limit after cleanup: {new_memory:.2f} GB")
                return False
            else:
                logger.info(f"Memory brought under control: {new_memory:.2f} GB")
                return True
        
        return True
    
    def optimize_for_memory(self, model: torch.nn.Module) -> torch.nn.Module:
        """
        Apply memory optimizations to model.
        
        Args:
            model: PyTorch model to optimize
            
        Returns:
            Optimized model
        """
        logger.info("Applying memory optimizations to model...")
        
        # Enable memory-efficient attention if configured
        if self.memory_efficient_attention:
            self._enable_memory_efficient_attention(model)
        
        # Enable gradient checkpointing for larger models
        if hasattr(model, 'gradient_checkpointing'):
            model.gradient_checkpointing = True
            logger.info("Enabled gradient checkpointing")
        
        # Set model to use less memory-intensive precision if supported
        if self.gpu_available and hasattr(torch.cuda, 'amp'):
            logger.info("Mixed precision training will be enabled")
        
        return model
    
    def _enable_memory_efficient_attention(self, model: torch.nn.Module):
        """Enable memory-efficient attention mechanisms."""
        try:
            # Look for attention layers and optimize them
            for name, module in model.named_modules():
                if 'attention' in name.lower():
                    # Enable memory-efficient attention if available
                    if hasattr(module, 'memory_efficient'):
                        module.memory_efficient = True
                        logger.info(f"Enabled memory-efficient attention for {name}")
        except Exception as e:
            logger.warning(f"Could not enable memory-efficient attention: {e}")
    
    def get_optimal_batch_size(self, model: torch.nn.Module, input_shape: tuple, 
                             max_batch_size: int = 32) -> int:
        """
        Determine optimal batch size based on available memory.
        
        Args:
            model: PyTorch model
            input_shape: Shape of input tensor (without batch dimension)
            max_batch_size: Maximum batch size to test
            
        Returns:
            Optimal batch size
        """
        logger.info("Determining optimal batch size...")
        
        model.eval()
        optimal_batch_size = 1
        
        # Start with conservative memory threshold (60% of limit)
        memory_threshold = self.max_memory_gb * 0.6
        
        try:
            for batch_size in [1, 2, 4, 8]:  # More conservative batch size testing
                if batch_size > max_batch_size:
                    break
                
                # Clear memory before test
                self.cleanup_memory()
                
                # Test memory usage with this batch size
                dummy_input = torch.randn(batch_size, *input_shape).to(self.device)
                
                try:
                    with torch.no_grad():
                        _ = model(dummy_input)
                    
                    # Check memory usage after forward pass
                    current_memory = self.get_memory_usage()
                    
                    if current_memory < memory_threshold:
                        optimal_batch_size = batch_size
                        logger.debug(f"Batch size {batch_size}: Memory usage {current_memory:.2f} GB (OK)")
                    else:
                        logger.debug(f"Batch size {batch_size}: Memory usage {current_memory:.2f} GB (too high)")
                        break
                        
                except RuntimeError as e:
                    if "out of memory" in str(e).lower():
                        logger.debug(f"Batch size {batch_size}: Out of memory")
                        break
                    raise
                finally:
                    # Cleanup
                    del dummy_input
                    self.cleanup_memory()
        
        except Exception as e:
            logger.warning(f"Error determining optimal batch size: {e}")
        
        logger.info(f"Optimal batch size: {optimal_batch_size}")
        return optimal_batch_size
    
    def get_dynamic_batch_size(self, configured_batch_size: int) -> int:
        """
        Calculate dynamic batch size based on current memory usage.
        
        Args:
            configured_batch_size: Configured batch size from config
            
        Returns:
            Adjusted batch size
        """
        current_memory = self.get_memory_usage()
        memory_usage_percent = (current_memory / self.max_memory_gb) * 100
        
        # Reduce batch size if memory usage is high
        if memory_usage_percent > 80:
            return max(1, configured_batch_size // 4)
        elif memory_usage_percent > 70:
            return max(1, configured_batch_size // 2)
        elif memory_usage_percent > 60:
            return max(1, int(configured_batch_size * 0.75))
        else:
            return configured_batch_size
    
    def create_memory_efficient_dataloader(self, dataset, batch_size: int, **kwargs):
        """
        Create memory-efficient DataLoader.
        
        Args:
            dataset: Dataset to load
            batch_size: Batch size
            **kwargs: Additional DataLoader arguments
            
        Returns:
            Optimized DataLoader
        """
        # Memory-efficient DataLoader settings
        dataloader_kwargs = {
            'batch_size': batch_size,
            'pin_memory': self.config['data'].get('pin_memory', False),
            'num_workers': 0,  # Use 0 for memory efficiency
            'prefetch_factor': 2,
            'persistent_workers': False,
            **kwargs
        }
        
        # Remove incompatible arguments for num_workers=0
        if dataloader_kwargs['num_workers'] == 0:
            dataloader_kwargs.pop('prefetch_factor', None)
            dataloader_kwargs.pop('persistent_workers', None)
        
        from torch.utils.data import DataLoader
        return DataLoader(dataset, **dataloader_kwargs)
    
    def log_memory_summary(self):
        """Log comprehensive memory usage summary."""
        current_memory = self.get_memory_usage()
        gpu_used, gpu_total = self.get_gpu_memory_usage()
        
        logger.info("=== Memory Usage Summary ===")
        logger.info(f"Current memory usage: {current_memory:.2f} GB")
        logger.info(f"Peak memory usage: {self.peak_memory:.2f} GB")
        logger.info(f"Memory limit: {self.max_memory_gb:.2f} GB")
        logger.info(f"Memory usage: {(current_memory / self.max_memory_gb) * 100:.1f}% of limit")
        logger.info(f"Memory growth: {current_memory - self.initial_memory:.2f} GB")
        
        if self.gpu_available:
            logger.info(f"GPU memory: {gpu_used:.2f}/{gpu_total:.2f} GB "
                       f"({(gpu_used / gpu_total * 100) if gpu_total > 0 else 0:.1f}%)")
        
        # Recent memory trend
        if len(self.memory_history) >= 2:
            recent_growth = (self.memory_history[-1]['memory_gb'] - 
                           self.memory_history[0]['memory_gb'])
            logger.info(f"Recent memory trend: {recent_growth:+.2f} GB")
        
        logger.info("=" * 30)