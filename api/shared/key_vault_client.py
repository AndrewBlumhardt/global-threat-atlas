"""
Azure Key Vault integration for secrets management.
"""
import os
"""
Key Vault client removed. Use environment variables for secrets.
"""
        # Try Key Vault first
        if self._client:
            try:
                secret = self._client.get_secret(secret_name)
                logger.info(f"Retrieved secret '{secret_name}' from Key Vault")
                return secret.value
            except Exception as e:
                logger.warning(f"Failed to get secret '{secret_name}' from Key Vault: {e}")
        
        # Fallback to environment variable
        if fallback_env_var:
            value = os.environ.get(fallback_env_var)
            if value:
                logger.info(f"Using secret '{secret_name}' from environment variable {fallback_env_var}")
                return value
        
        logger.warning(f"Secret '{secret_name}' not found in Key Vault or environment")
        return None
