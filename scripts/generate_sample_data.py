#!/usr/bin/env python3
"""
Sample Data Generator for SoundDitect

This script generates sample training data in the expected JSON format
with synthetic audio waveforms for testing and development.

Usage: python scripts/generate_sample_data.py
All configuration is managed through config.yaml file.
"""

import json
import numpy as np
import yaml
from pathlib import Path
import logging
import sys

logger = logging.getLogger(__name__)

def load_config():
    """Load configuration from config.yaml"""
    config_path = Path(__file__).parent.parent / "config.yaml"
    if not config_path.exists():
        raise FileNotFoundError(f"Configuration file not found: {config_path}")
    
    with open(config_path, 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)

class SampleDataGenerator:
    """Generator for synthetic audio data in the expected JSON format."""
    
    def __init__(self, sample_rate=44100, duration=1.0):
        self.sample_rate = sample_rate
        self.duration = duration
        self.samples_per_file = int(sample_rate * duration)
    
    def generate_normal_waveform(self):
        """Generate a normal audio waveform (background noise, speech, etc.)"""
        # Generate time array
        t = np.linspace(0, self.duration, self.samples_per_file)
        
        # Base waveform with multiple frequency components (simulating speech/music)
        frequencies = [440, 880, 1320]  # A4, A5, E6
        amplitudes = [0.3, 0.2, 0.1]
        
        waveform = np.zeros_like(t)
        for freq, amp in zip(frequencies, amplitudes):
            waveform += amp * np.sin(2 * np.pi * freq * t)
        
        # Add some noise to make it more realistic
        noise = np.random.normal(0, 0.05, len(t))
        waveform += noise
        
        # Apply envelope to make it more natural
        envelope = np.exp(-t * 2)  # Exponential decay
        waveform *= envelope
        
        # Normalize
        waveform = waveform / np.max(np.abs(waveform)) * 0.8
        
        return waveform.tolist()
    
    def generate_anomaly_waveform(self):
        """Generate an anomalous audio waveform (impact sounds, crashes, etc.)"""
        t = np.linspace(0, self.duration, self.samples_per_file)
        
        # Sharp impact with quick decay
        impact_time = 0.1  # Impact at 0.1 seconds
        impact_duration = 0.05  # Very short duration
        
        # Create impulse
        impulse_samples = int(impact_duration * self.sample_rate)
        impulse_start = int(impact_time * self.sample_rate)
        
        waveform = np.zeros_like(t)
        
        # High-frequency transient (typical of impact sounds)
        if impulse_start + impulse_samples < len(waveform):
            impulse_t = t[impulse_start:impulse_start + impulse_samples]
            # Multiple high frequencies with sharp attack
            impulse = (np.sin(2 * np.pi * 2000 * impulse_t) * 0.8 +
                      np.sin(2 * np.pi * 4000 * impulse_t) * 0.6 +
                      np.sin(2 * np.pi * 8000 * impulse_t) * 0.4)
            
            # Sharp decay
            decay = np.exp(-impulse_t * 50)
            impulse *= decay
            
            waveform[impulse_start:impulse_start + impulse_samples] = impulse
        
        # Add some reverb/echo
        echo_delay = int(0.05 * self.sample_rate)  # 50ms echo
        echo_amplitude = 0.3
        
        if len(waveform) > echo_delay:
            waveform[echo_delay:] += echo_amplitude * waveform[:-echo_delay]
        
        # Add high-frequency noise burst
        noise_start = impulse_start
        noise_duration = int(0.2 * self.sample_rate)
        if noise_start + noise_duration < len(waveform):
            noise = np.random.normal(0, 0.2, noise_duration)
            # High-pass filter effect
            noise = noise * np.exp(-np.arange(noise_duration) / (0.1 * self.sample_rate))
            waveform[noise_start:noise_start + noise_duration] += noise
        
        # Normalize
        if np.max(np.abs(waveform)) > 0:
            waveform = waveform / np.max(np.abs(waveform)) * 0.9
        
        return waveform.tolist()
    
    def generate_dataset(self, output_dir, num_files=10, samples_per_file=100):
        """
        Generate a complete dataset with multiple JSON files.
        
        Args:
            output_dir: Directory to save the JSON files
            num_files: Number of JSON files to create
            samples_per_file: Number of audio samples per file
        """
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        total_normal = 0
        total_anomaly = 0
        
        for file_idx in range(num_files):
            file_data = []
            
            for sample_idx in range(samples_per_file):
                # 70% normal, 30% anomaly
                is_anomaly = np.random.random() < 0.3
                
                if is_anomaly:
                    waveform = self.generate_anomaly_waveform()
                    label = 1
                    total_anomaly += 1
                else:
                    waveform = self.generate_normal_waveform()
                    label = 0
                    total_normal += 1
                
                # Create data entry in expected format
                data_entry = {
                    "Waveform": waveform,
                    "Labels": label
                }
                
                file_data.append(data_entry)
            
            # Save file
            filename = output_path / f"audio_data_{file_idx:03d}.json"
            with open(filename, 'w') as f:
                json.dump(file_data, f, indent=2)
            
            logger.info(f"Generated {filename} with {samples_per_file} samples")
        
        logger.info(f"Dataset generation complete!")
        logger.info(f"Total files: {num_files}")
        logger.info(f"Total samples: {total_normal + total_anomaly}")
        logger.info(f"Normal samples: {total_normal}")
        logger.info(f"Anomaly samples: {total_anomaly}")
        logger.info(f"Anomaly ratio: {total_anomaly / (total_normal + total_anomaly):.2%}")

def main():
    """Main function to generate sample data using config.yaml settings"""
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    logger.info("🚀 Starting sample data generation...")
    
    # Load configuration
    try:
        config = load_config()
    except Exception as e:
        logger.error(f"❌ Configuration error: {e}")
        logger.error("Please ensure config.yaml exists and contains all required settings.")
        sys.exit(1)
    
    # Extract configuration values
    sample_rate = config['audio']['sample_rate']
    output_dir = config['data']['data_dir']
    
    # Sample generation settings (add these to config.yaml if needed)
    num_files = config.get('sample_generation', {}).get('num_files', 10)
    samples_per_file = config.get('sample_generation', {}).get('samples_per_file', 100)
    duration = 1.0  # Fixed 1 second as per requirements
    
    logger.info(f"📂 Output directory: {output_dir}")
    logger.info(f"🎵 Sample rate: {sample_rate} Hz")
    logger.info(f"⏱️  Duration per sample: {duration} seconds")
    logger.info(f"📁 Number of files: {num_files}")
    logger.info(f"📄 Samples per file: {samples_per_file}")
    
    # Create generator and generate dataset
    generator = SampleDataGenerator(
        sample_rate=sample_rate,
        duration=duration
    )
    
    try:
        generator.generate_dataset(
            output_dir=output_dir,
            num_files=num_files,
            samples_per_file=samples_per_file
        )
        logger.info("✅ Sample data generation completed successfully!")
    except Exception as e:
        logger.error(f"❌ Data generation error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()