import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../config/theme.dart';
import '../data/quotes.dart';
import '../state/auth_provider.dart';
import '../widgets/warm_card.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);
    final quote = quoteOfTheDay();
    final narrow = MediaQuery.sizeOf(context).width < 720;

    return Scaffold(
      backgroundColor: AppColors.snow,
      body: Stack(
        children: [
          // Ambient orb
          Positioned(
            top: -120,
            right: -120,
            child: Container(
              width: 400,
              height: 400,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(colors: [
                  AppColors.accentGlow.withValues(alpha: 0.15),
                  Colors.transparent,
                ]),
              ),
            ),
          ),
          SafeArea(
            child: SingleChildScrollView(
              padding: EdgeInsets.symmetric(
                horizontal: narrow ? 20 : 40,
                vertical: 32,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Greeting
                  RichText(
                    text: TextSpan(
                      style: AppTypography.display(
                        fontSize: narrow ? 28 : 40,
                        color: AppColors.ink,
                      ),
                      children: [
                        const TextSpan(text: 'Welcome back,\n'),
                        TextSpan(
                          text: '${auth.username ?? 'friend'}.',
                          style: TextStyle(
                            fontStyle: FontStyle.italic,
                            color: AppColors.accent,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 32),

                  // Quote of the day
                  WarmCard(
                    padding: const EdgeInsets.all(28),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Icon(Icons.format_quote_rounded,
                                size: 22, color: AppColors.accent),
                            const SizedBox(width: 8),
                            Text('THOUGHT OF THE DAY',
                                style: AppTypography.label(
                                    color: AppColors.accent)),
                          ],
                        ),
                        const SizedBox(height: 16),
                        Text(
                          '"$quote"',
                          style: AppTypography.title(
                            fontSize: 20,
                            color: AppColors.ink,
                          ).copyWith(
                            fontStyle: FontStyle.italic,
                            height: 1.5,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),

                  // About section
                  WarmCard(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Icon(Icons.info_outline_rounded,
                                size: 20, color: AppColors.lavender),
                            const SizedBox(width: 8),
                            Text('ABOUT UNBURDEN',
                                style: AppTypography.label(
                                    color: AppColors.lavender)),
                          ],
                        ),
                        const SizedBox(height: 14),
                        Text(
                          'Unburden is a safe, anonymous space where you can speak freely '
                          'and be heard - no judgement, no identity, just honest human connection.',
                          style: AppTypography.body(
                            fontSize: 14,
                            color: AppColors.graphite,
                          ).copyWith(height: 1.6),
                        ),
                        const SizedBox(height: 12),
                        Text(
                          'Whether you need to vent or you want to listen, this is your space.',
                          style: AppTypography.body(
                            fontSize: 14,
                            color: AppColors.graphite,
                          ).copyWith(height: 1.6),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),

                  // How it works
                  WarmCard(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Icon(Icons.lightbulb_outline_rounded,
                                size: 20, color: AppColors.amber),
                            const SizedBox(width: 8),
                            Text('HOW IT WORKS',
                                style: AppTypography.label(
                                    color: AppColors.amber)),
                          ],
                        ),
                        const SizedBox(height: 14),
                        _howStep(
                            '1', 'Vent', 'Share what\'s on your mind anonymously.'),
                        const SizedBox(height: 10),
                        _howStep('2', 'Listen',
                            'Be there for someone who needs to be heard.'),
                        const SizedBox(height: 10),
                        _howStep('3', 'Connect',
                            'Real conversations. No names. No pressure.'),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Wellbeing tip
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: AppColors.lavender.withValues(alpha: 0.12),
                      borderRadius: AppRadii.lgAll,
                      border: Border.all(
                          color: AppColors.lavender.withValues(alpha: 0.25)),
                    ),
                    child: Row(
                      children: [
                        const Text('🧘', style: TextStyle(fontSize: 28)),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Take a moment',
                                  style: AppTypography.title(
                                      fontSize: 16, color: AppColors.ink)),
                              const SizedBox(height: 4),
                              Text(
                                'Close your eyes. Take 3 deep breaths. You deserve this pause.',
                                style: AppTypography.body(
                                    fontSize: 13, color: AppColors.graphite),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 40),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  static Widget _howStep(String num, String title, String desc) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 28,
          height: 28,
          decoration: BoxDecoration(
            color: AppColors.accent.withValues(alpha: 0.15),
            shape: BoxShape.circle,
          ),
          alignment: Alignment.center,
          child: Text(num,
              style: AppTypography.ui(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: AppColors.accent)),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title,
                  style: AppTypography.ui(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: AppColors.ink)),
              Text(desc,
                  style:
                      AppTypography.body(fontSize: 13, color: AppColors.slate)),
            ],
          ),
        ),
      ],
    );
  }
}
