import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './login.html'
})

export class LoginComponent {
  // Login con Azure (redirige a Cognito Hosted UI con Azure como provider)
  loginConAzure() {
    const cognitoHostedUiUrl = `https://${this.getCognitoDomain()}/oauth2/authorize?client_id=${this.getCognitoClientId()}&response_type=code&scope=openid+email+profile&redirect_uri=${this.getRedirectUri()}&identity_provider=Azure`;
    window.location.href = cognitoHostedUiUrl;
  }

  // Helpers para construir URLs de Cognito (se obtienen del environment)
  private getCognitoDomain(): string {
    // Este valor debe estar en environment.cognito.domain
    return (window as any).__COGNITO_DOMAIN__ || 'bacherito-dev.auth.us-east-1.amazoncognito.com';
  }

  private getCognitoClientId(): string {
    // Este valor debe estar en environment.cognito.clientId
    return (window as any).__COGNITO_CLIENT_ID__ || '';
  }

  private getRedirectUri(): string {
    return `${window.location.origin}/auth/callback`;
  }
}