import React, { useEffect, useRef } from 'react';
import { View, Text, Image, TouchableOpacity, Animated } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { UserProfile } from '../types';

interface HeaderProps {
    user: UserProfile;
    onProfilePress?: () => void;
    onNotificationsPress?: () => void;
    notificationCount?: number;
    // onLogoutPress removed, now handled in profile modal
}

const Header: React.FC<HeaderProps> = ({ user, onProfilePress, onNotificationsPress, notificationCount = 0 }) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        let animation: Animated.CompositeAnimation;
        if (notificationCount > 0) {
            animation = Animated.loop(
                Animated.sequence([
                    Animated.timing(scaleAnim, {
                        toValue: 1.3,
                        duration: 600,
                        useNativeDriver: true,
                    }),
                    Animated.timing(scaleAnim, {
                        toValue: 1,
                        duration: 600,
                        useNativeDriver: true,
                    }),
                ])
            );
            animation.start();
        }
        return () => animation?.stop();
    }, [notificationCount]);

    return (
        <View className="flex-row items-center justify-between px-4 py-4 bg-green-600 border-b border-green-700">
            <TouchableOpacity onPress={onProfilePress} className="flex-row items-center gap-3">
                <View style={{ position: 'relative' }}>
                    <Image
                        source={{ uri: user.avatar || 'https://ui-avatars.com/api/?name=Guardia&background=3b82f6&color=fff' }}
                        className="w-11 h-11 rounded-full border-2 border-white"
                    />
                    <View style={{ position: 'absolute', bottom: 0, right: 0 }} className={`w-3 h-3 rounded-full border-2 border-white ${user.isActive ? 'bg-green-400' : 'bg-white/60'}`} />
                </View>
                <View className="flex-col ml-3">
                    <Text className="text-[11px] text-green-100 font-medium uppercase tracking-wider">Bienvenido</Text>
                    <Text className="text-sm font-bold text-white leading-tight">{user.name}</Text>
                </View>
            </TouchableOpacity>
            <View className="flex-row items-center gap-2">
                <TouchableOpacity onPress={onNotificationsPress} className="relative p-2 rounded-full bg-white/20">
                    <MaterialIcons name="chat" size={24} color="white" />
                    {notificationCount > 0 && (
                        <Animated.View 
                            style={{ transform: [{ scale: scaleAnim }] }}
                            className="absolute top-1 right-1 min-w-[16px] h-4 bg-red-500 rounded-full border border-white items-center justify-center px-1"
                        >
                            <Text className="text-[9px] font-bold text-white">{notificationCount > 9 ? '9+' : notificationCount}</Text>
                        </Animated.View>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
};

export default Header;
